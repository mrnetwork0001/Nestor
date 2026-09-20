import { WebhookVerificationError, verifyAgentMailWebhook, type AgentMailEvent } from "@agentmail/convex";
import { createFunctionHandle } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { logActivity } from "./activity";
import {
  AgentMailHttpError,
  COMPONENT_EVENT_TYPES,
  type AgentMailInbox,
  bareAddress,
  createInbox,
  createWebhook,
  describeAgentMailError,
  displayNameOf,
  getMessage,
  listInboxes,
  listMessages,
  normalizeMessage,
  replyToMessage,
  sendMessage,
  toComponentMessage,
} from "./agentmailApi";
import { agentmailLive, agentmailPolling, inboundLive } from "./lib/integrations";
import { MAX_OUTBOUND_PER_THREAD } from "./lib/negotiationPolicy";
import { mailboxRole, messageChannel } from "./lib/validators";

/*
 * Mail in and out.
 *
 * Out: plain REST (agentmailApi.ts), because the component's send path cannot
 * see the API key. In: the @agentmail/convex component. Signed webhooks and
 * the local-dev poller both end in `components.agentmail.lib.handleEvent`,
 * which dedupes by event id, stores the message and calls
 * `onMessageReceived` below on a workpool.
 *
 * Nestor has two inboxes for every renter: the agent's, and the demo
 * landlord's. Conversations are told apart by AgentMail thread id.
 */

// AgentMail rejects parentheses in display names.
const AGENT_INBOX = { username: "nestor-concierge", displayName: "Nestor AI Rental Assistant", clientId: "nestor-agent-inbox-v1" };
const SIM_INBOX = { username: "nestor-demo-landlord", displayName: "Nestor Demo Landlord", clientId: "nestor-landlord-demo-v1" };

// A demo email that has not come back by then is answered inside Convex instead.
const SIM_EMAIL_PATIENCE_MS = 90_000;

// Mailboxes -------------------------------------------------------------------------

export const mailboxes = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("mailboxes").take(10),
});

export const saveMailbox = internalMutation({
  args: { role: mailboxRole, inboxId: v.string(), email: v.string(), displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mailboxes")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .first();
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("mailboxes", args);
    return null;
  },
});

type Mailboxes = { agent: Doc<"mailboxes">; landlordSim: Doc<"mailboxes"> };

async function openInbox(spec: typeof AGENT_INBOX) {
  try {
    return await createInbox(spec);
  } catch (e) {
    // The preferred username may belong to someone else. Any address works, so let AgentMail pick one.
    const retryable = e instanceof AgentMailHttpError && ![401, 403, 429].includes(e.status) && e.status < 500;
    if (!retryable) throw e;
    return await createInbox({ displayName: spec.displayName, clientId: spec.clientId });
  }
}

/**
 * Sets up Nestor's two inboxes once. An inbox that is already Nestor's (same client id, or the
 * exact username) is adopted before anything is created, so a key without permission to create
 * inboxes still works once the owner has made the two inboxes in the AgentMail console. No other
 * inbox in the account is ever touched: it may hold someone's unrelated mail.
 */
async function ensureMailboxesIn(ctx: ActionCtx): Promise<Mailboxes> {
  let rows: Doc<"mailboxes">[] = await ctx.runQuery(internal.mail.mailboxes, {});
  let remote: AgentMailInbox[] | null = null;
  for (const [role, spec] of [["agent", AGENT_INBOX], ["landlord_sim", SIM_INBOX]] as const) {
    if (rows.some((row) => row.role === role)) continue;
    remote ??= await listInboxes().catch(() => []);
    const inbox =
      remote.find((box) => box.client_id === spec.clientId) ??
      remote.find((box) => box.inbox_id.toLowerCase().startsWith(`${spec.username}@`)) ??
      (await openInbox(spec));
    await ctx.runMutation(internal.mail.saveMailbox, {
      role,
      inboxId: inbox.inbox_id,
      email: inbox.email ?? inbox.inbox_id,
      displayName: inbox.display_name ?? spec.displayName,
    });
  }
  rows = await ctx.runQuery(internal.mail.mailboxes, {});
  const agent = rows.find((row) => row.role === "agent");
  const landlordSim = rows.find((row) => row.role === "landlord_sim");
  if (!agent || !landlordSim) throw new Error("Nestor's inboxes could not be set up.");
  return { agent, landlordSim };
}

export const ensureMailboxes = internalAction({
  args: {},
  returns: v.object({ agent: v.string(), landlordSim: v.string() }),
  handler: async (ctx) => {
    if (!agentmailLive()) throw new Error("AgentMail is not connected on this deployment.");
    const boxes = await ensureMailboxesIn(ctx);
    return { agent: boxes.agent.email, landlordSim: boxes.landlordSim.email };
  },
});

/**
 * Cloud deployments only: subscribes this deployment's /agentmail/webhook to
 * both inboxes. Returns the signing secret once, for the operator to store:
 *   npx convex env set AGENTMAIL_WEBHOOK_SECRET <secret>
 */
export const registerWebhook = internalAction({
  args: {},
  returns: v.object({ webhookId: v.string(), url: v.string(), secret: v.string() }),
  handler: async (ctx) => {
    if (!agentmailLive()) throw new Error("AgentMail is not connected on this deployment.");
    const site = new URL(env.CONVEX_SITE_URL);
    if (["127.0.0.1", "localhost", "0.0.0.0"].includes(site.hostname)) {
      throw new Error("This deployment has no public URL, so AgentMail cannot reach it. Local development polls instead (AGENTMAIL_POLL=1).");
    }
    const boxes = await ensureMailboxesIn(ctx);
    // A webhook is tied to one URL, so the idempotency key carries the deployment name.
    const deployment = site.hostname.split(".")[0].replace(/[^a-zA-Z0-9-]/g, "-");
    const webhook = await createWebhook({
      url: `${site.origin}/agentmail/webhook`,
      inboxIds: [boxes.agent.inboxId, boxes.landlordSim.inboxId],
      clientId: `nestor-webhook-${deployment}`,
    });
    return { webhookId: webhook.webhook_id, url: webhook.url, secret: webhook.secret };
  },
});

// Outbound --------------------------------------------------------------------------

export const deliveryContext = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (message === null) return null;
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;
    const history = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(200);
    const exchanged = history.filter((m) => m.status === "sent" || m.status === "received");
    // Never thread a reply under a bounce.
    const latestInbound = [...exchanged].reverse().find((m) => m.direction === "inbound" && !AUTOMATED_SENDER.test(m.fromAddress));
    return {
      message,
      thread,
      sentCount: exchanged.filter((m) => m.direction === "outbound").length,
      // Once any part of a demo conversation happened inside Convex it stays there, so the
      // renter never waits on email twice.
      wentOffEmail: exchanged.some((m) => m.channel === "simulated"),
      replyTo: latestInbound?.agentmailMessageId ?? null,
    };
  },
});

// AgentMail dedupes on this key for 24 hours. The body hash lets an edited retry through.
function idempotencyKey(message: Doc<"messages">): string {
  let hash = 2166136261;
  for (const ch of `${message.subject}\n${message.body}`) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  }
  return `nestor-${message._id}-${hash.toString(16)}`;
}

export const deliver = internalAction({
  args: { messageId: v.id("messages"), viaEmail: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { messageId, viaEmail }) => {
    const data = await ctx.runQuery(internal.mail.deliveryContext, { messageId });
    if (data === null || data.message.status !== "queued") return null;
    const { message, thread } = data;

    if (thread.stage === "closed" || thread.stage === "declined") {
      // Closing only discards drafts; a message queued a moment earlier is stopped here.
      await ctx.runMutation(internal.mail.markUnsent, {
        messageId,
        permanent: true,
        error: "This conversation was closed before the email went out.",
      });
      return null;
    }

    if (data.sentCount >= MAX_OUTBOUND_PER_THREAD) {
      await ctx.runMutation(internal.mail.markUnsent, {
        messageId,
        permanent: true,
        error: `Nestor stops after ${MAX_OUTBOUND_PER_THREAD} emails in one conversation.`,
      });
      return null;
    }

    const insideConvex = {
      messageId,
      channel: "simulated" as const,
      fromAddress: message.fromAddress,
      toAddress: thread.landlordEmail,
    };
    if (thread.isSimulated && (viaEmail === false || !inboundLive() || data.wentOffEmail)) {
      await ctx.runMutation(internal.mail.markSent, insideConvex);
      return null;
    }
    if (!agentmailLive()) {
      await ctx.runMutation(internal.mail.markUnsent, {
        messageId,
        permanent: false,
        error: "AgentMail is not connected on this deployment, so real email cannot be sent.",
      });
      return null;
    }

    try {
      const boxes = await ensureMailboxesIn(ctx);
      // A demo thread only ever writes to Nestor's own demo-landlord inbox.
      const to = thread.isSimulated ? boxes.landlordSim.email : thread.landlordEmail;
      const labels = ["nestor", thread.isSimulated ? "demo" : "outreach"];
      const sent = data.replyTo
        ? await replyToMessage({
            inboxId: boxes.agent.inboxId,
            parentMessageId: data.replyTo,
            // Pinned: otherwise AgentMail answers whoever wrote last, not the address the renter approved.
            to: [to],
            text: message.body,
            labels,
            idempotencyKey: idempotencyKey(message),
          })
        : await sendMessage({
            inboxId: boxes.agent.inboxId,
            to,
            subject: message.subject,
            text: message.body,
            labels,
            idempotencyKey: idempotencyKey(message),
          });
      await ctx.runMutation(internal.mail.markSent, {
        messageId,
        channel: "agentmail",
        fromAddress: boxes.agent.email,
        toAddress: to,
        agentmailMessageId: sent.message_id,
        agentmailThreadId: sent.thread_id,
      });
    } catch (e) {
      console.warn(`AgentMail send failed: ${e instanceof Error ? e.message : String(e)}`);
      if (thread.isSimulated) {
        // The demo must not depend on email working.
        await ctx.runMutation(internal.mail.markSent, insideConvex);
      } else {
        await ctx.runMutation(internal.mail.markUnsent, { messageId, permanent: false, error: describeAgentMailError(e) });
      }
    }
    return null;
  },
});

export const markSent = internalMutation({
  args: {
    messageId: v.id("messages"),
    channel: messageChannel,
    fromAddress: v.string(),
    toAddress: v.string(),
    agentmailMessageId: v.optional(v.string()),
    agentmailThreadId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (message === null || message.status !== "queued") return null;
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;
    const now = Date.now();

    await ctx.db.patch(message._id, {
      status: "sent",
      channel: args.channel,
      fromAddress: args.fromAddress,
      toAddress: args.toAddress,
      agentmailMessageId: args.agentmailMessageId,
      sentAt: now,
      error: undefined,
    });
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(50);
    // The send raced a close or a rejection: record it, but leave the conversation over.
    const over = thread.stage === "closed" || thread.stage === "declined";
    await ctx.db.patch(thread._id, {
      ...(over ? {} : { stage: tours.some((t) => t.status === "confirmed") ? ("tour_scheduled" as const) : ("awaiting_reply" as const) }),
      lastMessageAt: now,
      landlordEmail: thread.isSimulated ? args.toAddress : thread.landlordEmail,
      agentmailThreadId: args.agentmailThreadId ?? thread.agentmailThreadId,
    });

    const listing = await ctx.db.get(thread.listingId);
    const who = thread.landlordName ?? "the landlord";
    await logActivity(ctx, {
      renterId: thread.renterId,
      kind: "negotiator",
      title: `Emailed ${who} about ${listing?.title ?? listing?.address ?? "the listing"}`,
      detail:
        args.channel === "agentmail"
          ? `Sent from ${args.fromAddress} with AgentMail${thread.isSimulated ? " to Nestor's demo landlord inbox" : ""}.`
          : "Demo landlord: this message stayed inside Nestor, no real email was sent.",
      listingId: thread.listingId,
      threadId: thread._id,
    });

    if (thread.isSimulated && !over) {
      if (args.channel === "simulated") {
        const thinkingTime = 4000 + Math.floor(Math.random() * 4000);
        await ctx.scheduler.runAfter(thinkingTime, internal.landlordSim.reply, { threadId: thread._id, outboundMessageId: message._id });
      } else {
        await ctx.scheduler.runAfter(SIM_EMAIL_PATIENCE_MS, internal.landlordSim.watchdog, { outboundMessageId: message._id });
      }
    }
    return null;
  },
});

/** Scheduled with every delivery. Deliveries are actions and are not retried, so a dead one is settled here. */
export const expireQueued = internalMutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (message === null || message.status !== "queued") return null;
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;
    // Both targets do nothing unless the message is still queued.
    if (thread.isSimulated) {
      await ctx.scheduler.runAfter(0, internal.mail.markSent, {
        messageId,
        channel: "simulated",
        fromAddress: message.fromAddress,
        toAddress: thread.landlordEmail ?? message.toAddress,
      });
    } else {
      // A retry reuses the idempotency key, so AgentMail drops it if the first send did go out.
      await ctx.scheduler.runAfter(0, internal.mail.markUnsent, {
        messageId,
        permanent: false,
        error: "Sending took too long. Approve the draft again to retry.",
      });
    }
    return null;
  },
});

export const markUnsent = internalMutation({
  args: { messageId: v.id("messages"), error: v.string(), permanent: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { messageId, error, permanent }) => {
    const message = await ctx.db.get(messageId);
    if (message === null || message.status !== "queued") return null;
    // A send that can be retried goes back to being a draft, with the reason attached.
    await ctx.db.patch(messageId, { status: permanent ? "failed" : "draft", error });
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;
    if (thread.stage !== "closed" && thread.stage !== "declined") {
      await ctx.db.patch(thread._id, { stage: permanent ? (thread.lastInboundAt ? "negotiating" : "awaiting_reply") : "needs_approval" });
    }
    await logActivity(ctx, {
      renterId: thread.renterId,
      kind: "system",
      title: permanent ? "An email was not sent" : "An email could not be sent and is waiting for you",
      detail: error,
      listingId: thread.listingId,
      threadId: thread._id,
    });
    return null;
  },
});

// Inbound ---------------------------------------------------------------------------

type InboundEmail = {
  thread: Doc<"threads">;
  channel: "agentmail" | "simulated";
  fromAddress: string;
  fromName: string | null;
  toAddress: string;
  subject: string;
  body: string;
  agentmailMessageId?: string;
  receivedAt: number;
  // Bounces and out-of-office notes: shown to the renter, never read by the model or answered.
  automated?: boolean;
};

const AUTOMATED_SENDER = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster)@/i;
const AUTOMATED_SUBJECT = /^\s*(automatic reply|auto[- ]?reply|out of office|undeliverable|delivery status|mail delivery)/i;

/** The one way a landlord's words enter a conversation, whether they came by email or from the demo landlord. */
async function ingestInbound(ctx: MutationCtx, email: InboundEmail): Promise<Id<"messages"> | null> {
  const { thread } = email;
  const history = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .take(40);
  if (thread.isSimulated) {
    // The demo landlord answers each email once. A slow email reply that lands after the
    // in-Convex fallback already answered is dropped here.
    const lastSent = history.find((m) => m.direction === "outbound" && m.status === "sent");
    const lastInbound = history.find((m) => m.direction === "inbound");
    if (!lastSent) return null;
    if (lastInbound && lastInbound._creationTime > (lastSent.sentAt ?? lastSent._creationTime)) return null;
    // Same for a whole conversation that already moved inside Convex.
    const movedInside = history.some((m) => m.channel === "simulated" && (m.status === "sent" || m.status === "received"));
    if (email.channel === "agentmail" && movedInside) return null;
  }

  const messageId = await ctx.db.insert("messages", {
    threadId: thread._id,
    renterId: thread.renterId,
    direction: "inbound",
    status: "received",
    channel: email.channel,
    fromAddress: email.fromAddress,
    toAddress: email.toAddress,
    subject: email.subject || `Re: ${thread.subject}`,
    body: email.body || "(This email had no readable text.)",
    agentmailMessageId: email.agentmailMessageId,
    sentAt: email.receivedAt,
    analysis: email.automated
      ? {
          intent: "other",
          summary: "An automatic reply. Nestor did not answer it.",
          sentiment: "neutral",
          tourSlots: [],
          concessions: [],
          questionsForRenter: [],
        }
      : undefined,
  });
  if (email.automated) {
    await ctx.db.patch(thread._id, { unread: true, lastMessageAt: Date.now() });
    await logActivity(ctx, {
      renterId: thread.renterId,
      kind: "system",
      title: "An automatic reply arrived",
      detail: `${email.subject} ${email.body}`.replace(/\s+/g, " ").trim().slice(0, 160),
      listingId: thread.listingId,
      threadId: thread._id,
    });
    return messageId;
  }
  await ctx.db.patch(thread._id, {
    unread: true,
    lastInboundAt: email.receivedAt,
    lastMessageAt: Date.now(),
    landlordName: thread.landlordName ?? email.fromName ?? undefined,
    stage: thread.stage === "awaiting_reply" ? "negotiating" : thread.stage,
  });
  const listing = await ctx.db.get(thread.listingId);
  await logActivity(ctx, {
    renterId: thread.renterId,
    kind: "landlord",
    title: `${thread.landlordName ?? email.fromName ?? "The landlord"} replied about ${listing?.title ?? listing?.address ?? "the listing"}`,
    detail: email.body.replace(/\s+/g, " ").trim().slice(0, 160),
    listingId: thread.listingId,
    threadId: thread._id,
  });
  await ctx.scheduler.runAfter(0, internal.negotiator.handleInbound, { messageId });
  return messageId;
}

/** Called by the @agentmail/convex component once per inbound email, off the webhook path. */
export const onMessageReceived = internalMutation({
  args: { message: v.optional(v.any()), thread: v.optional(v.any()), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, { message }) => {
    const email = normalizeMessage(message);
    if (email === null) return null;
    const mailbox = await ctx.db
      .query("mailboxes")
      .withIndex("by_inbox", (q) => q.eq("inboxId", email.inboxId))
      .first();
    if (mailbox === null) return null;
    const sender = bareAddress(email.from);
    // Neither inbox ever reacts to its own mail.
    if (sender === bareAddress(mailbox.email)) return null;

    const candidates = [email.messageId, email.inReplyTo, ...email.references].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );

    if (mailbox.role === "landlord_sim") {
      const agent = await ctx.db
        .query("mailboxes")
        .withIndex("by_role", (q) => q.eq("role", "agent"))
        .first();
      // The demo landlord only ever talks to Nestor's own agent inbox.
      if (agent === null || sender !== bareAddress(agent.email)) return null;
      const thinkingTime = 4000 + Math.floor(Math.random() * 4000);
      await ctx.scheduler.runAfter(thinkingTime, internal.landlordSim.replyToEmail, {
        simMessageId: email.messageId,
        relatedMessageIds: candidates.slice(0, 12),
      });
      return null;
    }

    // Webhook and poller use different event ids for the same email.
    const duplicate = await ctx.db
      .query("messages")
      .withIndex("by_agentmail_message", (q) => q.eq("agentmailMessageId", email.messageId))
      .first();
    if (duplicate) return null;

    let thread = await ctx.db
      .query("threads")
      .withIndex("by_agentmail_thread", (q) => q.eq("agentmailThreadId", email.threadId))
      .first();
    for (const id of candidates.slice(1)) {
      if (thread) break;
      const parent = await ctx.db
        .query("messages")
        .withIndex("by_agentmail_message", (q) => q.eq("agentmailMessageId", id))
        .first();
      if (parent) thread = await ctx.db.get(parent.threadId);
    }
    if (thread === null) {
      // Mail that belongs to no conversation here (this inbox is shared between deployments). It is
      // stored by the component and otherwise ignored; there is no renter whose feed it belongs in.
      console.warn(`Unmatched inbound email in ${mailbox.role} inbox, AgentMail thread ${email.threadId}`);
      return null;
    }

    await ingestInbound(ctx, {
      thread,
      channel: "agentmail",
      fromAddress: sender,
      fromName: displayNameOf(email.from),
      toAddress: mailbox.email,
      subject: email.subject,
      body: email.body,
      agentmailMessageId: email.messageId,
      receivedAt: email.timestamp ?? Date.now(),
      automated: AUTOMATED_SENDER.test(sender) || AUTOMATED_SUBJECT.test(email.subject ?? ""),
    });
    return null;
  },
});

/** The demo landlord answering inside Convex. Same ingest as real email. */
export const ingestSimulated = internalMutation({
  args: { threadId: v.id("threads"), body: v.string() },
  returns: v.union(v.id("messages"), v.null()),
  handler: async (ctx, { threadId, body }) => {
    const thread = await ctx.db.get(threadId);
    if (thread === null || !thread.isSimulated) return null;
    const agent = await ctx.db
      .query("mailboxes")
      .withIndex("by_role", (q) => q.eq("role", "agent"))
      .first();
    return await ingestInbound(ctx, {
      thread,
      channel: "simulated",
      fromAddress: thread.landlordEmail,
      fromName: thread.landlordName ?? null,
      toAddress: agent?.email ?? "Nestor's inbox",
      subject: `Re: ${thread.subject}`,
      body,
      receivedAt: Date.now(),
    });
  },
});

// Into the component ---------------------------------------------------------------------

const STORABLE_EVENTS = new Set<string>([...COMPONENT_EVENT_TYPES, "domain.verified"]);

async function pushThroughComponent(ctx: ActionCtx, event: AgentMailEvent): Promise<void> {
  await ctx.runMutation(components.agentmail.lib.handleEvent, {
    config: {
      retryAttempts: 5,
      initialBackoffMs: 30_000,
      onMessageReceived: { fnHandle: await createFunctionHandle(internal.mail.onMessageReceived) },
    },
    event,
  });
}

/** POST /agentmail/webhook. Signature check and storage are the component's; this adds two guards. */
export async function handleAgentMailWebhook(ctx: ActionCtx, request: Request): Promise<Response> {
  const secret = env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook not configured", { status: 503 });

  const raw = await request.text();
  let event: AgentMailEvent;
  try {
    event = verifyAgentMailWebhook(secret, raw, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
  } catch (e) {
    if (e instanceof WebhookVerificationError) return new Response("invalid signature", { status: 401 });
    throw e;
  }

  // Guard 1: the component throws on event types it cannot store, and a 500 makes the sender
  // retry for hours and eventually disable the endpoint. Acknowledge and drop them instead.
  if (!STORABLE_EVENTS.has(event.event_type)) {
    return new Response(null, { status: 204 });
  }
  // Guard 2: hand the component a message in exactly the shape its table accepts.
  if (event.event_type === "message.received") {
    const message = toComponentMessage(event.message);
    if (message === null) return new Response(null, { status: 204 });
    event = { ...event, message, thread: { inbox_id: message.inbox_id, thread_id: message.thread_id } };
  }
  try {
    await pushThroughComponent(ctx, event);
  } catch (e) {
    // A message the component cannot store would otherwise be retried until the endpoint is disabled.
    console.error(`AgentMail event ${event.event_id} could not be stored: ${e instanceof Error ? e.message : String(e)}`);
  }
  return new Response(null, { status: 204 });
}

export const markPolled = internalMutation({
  args: { mailboxId: v.id("mailboxes") },
  returns: v.null(),
  handler: async (ctx, { mailboxId }) => {
    await ctx.db.patch(mailboxId, { lastPolledAt: Date.now() });
    return null;
  },
});

/**
 * Cron target. A local deployment has no public URL for webhooks, so it reads
 * both inboxes and feeds new mail through the same component ingest, with a
 * deterministic event id so a re-poll is a no-op.
 */
export const pollAll = internalAction({
  args: {},
  returns: v.object({ polled: v.number(), ingested: v.number() }),
  handler: async (ctx) => {
    if (!agentmailPolling()) return { polled: 0, ingested: 0 };
    const rows: Doc<"mailboxes">[] = await ctx.runQuery(internal.mail.mailboxes, {});
    let ingested = 0;
    for (const mailbox of rows) {
      try {
        const newestFirst = await listMessages(mailbox.inboxId, 20);
        const received = newestFirst.filter((item) => item.labels?.includes("received")).reverse();
        for (const item of received) {
          const stored: Array<{ messageId: string }> = await ctx.runQuery(
            components.agentmail.lib.listInboundMessages,
            { threadId: item.thread_id },
          );
          if (stored.some((row) => row.messageId === item.message_id)) continue;
          // One message that cannot be stored must not hold up the newer ones behind it.
          try {
            // List items carry no body.
            const message = toComponentMessage(await getMessage(mailbox.inboxId, item.message_id));
            if (message === null) continue;
            await pushThroughComponent(ctx, {
              type: "event",
              event_type: "message.received",
              event_id: `poll:${item.message_id}`,
              message,
              thread: { inbox_id: message.inbox_id, thread_id: message.thread_id },
            });
            ingested++;
          } catch (e) {
            console.warn(`Skipping message ${item.message_id}: ${describeAgentMailError(e)}`);
          }
        }
        await ctx.runMutation(internal.mail.markPolled, { mailboxId: mailbox._id });
      } catch (e) {
        console.warn(`Polling the ${mailbox.role} inbox failed: ${describeAgentMailError(e)}`);
      }
    }
    return { polled: rows.length, ingested };
  },
});

/**
 * Diagnostic, read-only: what this deployment's AgentMail key can see, without addresses.
 *   npx convex run mail:inspectAccount '{}'
 */
export const inspectAccount = internalAction({
  args: {},
  handler: async () => {
    if (!agentmailLive()) throw new Error("AgentMail is not connected on this deployment.");
    const inboxes = await listInboxes();
    const ours = [AGENT_INBOX, SIM_INBOX];
    return {
      inboxCount: inboxes.length,
      inboxes: inboxes.map((inbox) => ({
        clientId: inbox.client_id ?? null,
        matchesNestorClientId: ours.some((spec) => spec.clientId === inbox.client_id),
        matchesNestorUsername: ours.some((spec) => inbox.inbox_id.toLowerCase().startsWith(`${spec.username}@`)),
        displayName: inbox.display_name ?? null,
      })),
    };
  },
});

/**
 * Diagnostic: the shape of the newest messages in one inbox, without bodies.
 *   npx convex run mail:inspectInbox '{"role":"landlord_sim"}'
 */
export const inspectInbox = internalAction({
  args: { role: mailboxRole, limit: v.optional(v.number()) },
  handler: async (ctx, { role, limit }) => {
    if (!agentmailLive()) throw new Error("AgentMail is not connected on this deployment.");
    const rows: Doc<"mailboxes">[] = await ctx.runQuery(internal.mail.mailboxes, {});
    const mailbox = rows.find((row) => row.role === role);
    if (!mailbox) throw new Error("That inbox has not been created yet. Run mail:ensureMailboxes first.");
    const items = await listMessages(mailbox.inboxId, Math.min(Math.max(limit ?? 5, 1), 20));
    const report = [];
    for (const item of items) {
      const full = await getMessage(mailbox.inboxId, item.message_id);
      const normalized = normalizeMessage(full);
      report.push({
        messageId: item.message_id,
        threadId: item.thread_id,
        labels: item.labels ?? [],
        timestamp: item.timestamp ?? null,
        fields: Object.keys(full).sort(),
        fromType: Array.isArray(full.from) ? "array" : typeof full.from,
        fromIsOtherNestorInbox: rows.some((row) => row._id !== mailbox._id && normalized !== null && bareAddress(normalized.from) === bareAddress(row.email)),
        inReplyTo: normalized?.inReplyTo ?? null,
        references: normalized?.references ?? [],
        bodySource: typeof full.extracted_text === "string" ? "extracted_text" : typeof full.text === "string" ? "text" : typeof full.html === "string" ? "html" : "none",
        bodyLength: normalized?.body.length ?? 0,
        subject: normalized?.subject ?? null,
      });
    }
    return report;
  },
});
