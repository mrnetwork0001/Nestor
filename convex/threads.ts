import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logActivity } from "./activity";
import type { DraftPurpose } from "./lib/aiSchemas";
import { getRenter, requireOwned } from "./lib/auth";
import { agentmailLive, inboundLive } from "./lib/integrations";
import { limits } from "./lib/limits";
import { MAX_OUTBOUND_PER_THREAD, ensureDisclosure, policyViolations } from "./lib/negotiationPolicy";
import { draftSource, replyAnalysis, type ThreadStage } from "./lib/validators";

/*
 * One thread is one email conversation between the Negotiator and one
 * landlord. The renter-facing functions here only change rows and schedule
 * work; the writing (negotiator.ts), the sending (mail.ts) and the demo
 * landlord (landlordSim.ts) run as internal actions and write back through the
 * internal mutations at the bottom of this file.
 */

// Shown on simulated threads until Nestor's demo-landlord inbox exists. `.example` never resolves.
const DEMO_LANDLORD_ADDRESS = "demo-landlord@nestor.example";
const DEMO_LANDLORD_NAMES = ["Dana Reyes", "Marcus Bell", "Priya Nair", "Tom Whitaker", "Elena Sokolova", "Grace Okafor"];

const OVER = new Set<ThreadStage>(["declined", "closed"]);

function dollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function listingName(listing: Doc<"listings"> | null): string {
  return listing?.title ?? listing?.address ?? "this listing";
}

function cleanText(value: string, max: number, what: string): string {
  const text = value.trim();
  if (text.length === 0) throw new ConvexError(`${what} cannot be empty.`);
  if (text.length > max) throw new ConvexError(`${what} is too long (max ${max} characters).`);
  return text;
}

async function sentOutboundCount(ctx: QueryCtx, threadId: Id<"threads">): Promise<number> {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .take(200);
  return messages.filter((m) => m.direction === "outbound" && m.status === "sent").length;
}

/** Where a thread sits when no draft is pending, worked out from what has actually happened. */
export async function restingStage(ctx: QueryCtx, thread: Doc<"threads">): Promise<ThreadStage> {
  if (OVER.has(thread.stage)) return thread.stage;
  const tours = await ctx.db
    .query("tours")
    .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
    .take(50);
  if (tours.some((t) => t.status === "confirmed")) return "tour_scheduled";
  const recent = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .take(40);
  const lastInbound = recent.find((m) => m.direction === "inbound");
  if (!lastInbound) return "awaiting_reply";
  const lastSent = recent.find((m) => m.direction === "outbound" && m.status === "sent");
  if (lastSent && (lastSent.sentAt ?? 0) > (lastInbound.sentAt ?? lastInbound._creationTime)) return "awaiting_reply";
  const analysis = lastInbound.analysis;
  if (analysis?.intent === "acceptance" && analysis.tourSlots.length === 0) return "terms_agreed";
  return "negotiating";
}

async function discardDrafts(ctx: MutationCtx, threadId: Id<"threads">): Promise<Doc<"messages"> | null> {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .take(200);
  let latest: Doc<"messages"> | null = null;
  for (const message of messages) {
    if (message.status !== "draft") continue;
    await ctx.db.patch(message._id, { status: "discarded" });
    latest = message;
  }
  return latest;
}

const QUEUED_WATCHDOG_MS = 3 * 60 * 1000;

/**
 * Marks a draft queued and schedules delivery, inside the email quotas.
 * Returns false when a real thread is over quota and `throwOnLimit` is off.
 * Demo threads never block: over quota they are delivered inside Convex
 * instead of over real email.
 */
async function queueDelivery(
  ctx: MutationCtx,
  renter: Doc<"renters">,
  thread: Doc<"threads">,
  messageId: Id<"messages">,
  throwOnLimit: boolean,
): Promise<boolean> {
  // A demo email that could never be answered (no webhook, no polling) stays inside Convex instead.
  let viaEmail = thread.isSimulated ? inboundLive() : agentmailLive();
  if (thread.isSimulated) {
    if (viaEmail) {
      const shared = await limits.check(ctx, "globalSimEmail");
      const own = shared.ok ? await limits.limit(ctx, "sendSimEmail", { key: renter._id }) : shared;
      if (own.ok) await limits.limit(ctx, "globalSimEmail");
      viaEmail = own.ok;
    }
  } else {
    // One address only hears from Nestor a few times a day, whoever is asking.
    const recipient = (thread.landlordEmail ?? "").toLowerCase();
    const perAddress = await limits.check(ctx, "recipientEmail", { key: recipient });
    if (!perAddress.ok) {
      if (!throwOnLimit) return false;
      throw new ConvexError("This address has already received several emails from Nestor today. Try again tomorrow.");
    }
    const shared = await limits.check(ctx, "globalExternalEmail");
    const own = shared.ok ? await limits.limit(ctx, "sendExternalEmail", { key: renter._id }) : shared;
    if (!own.ok) {
      if (!throwOnLimit) return false;
      throw new ConvexError(
        shared.ok
          ? "You have reached today's limit for emails to landlords. It resets tomorrow."
          : "Nestor has reached today's shared email limit. Please try again tomorrow.",
      );
    }
    await limits.limit(ctx, "globalExternalEmail");
    await limits.limit(ctx, "recipientEmail", { key: recipient });
  }

  await ctx.db.patch(messageId, { status: "queued", error: undefined });
  // Optimistic: delivery moves it back to needs_approval if the send fails.
  await ctx.db.patch(thread._id, { stage: "awaiting_reply" });
  await ctx.scheduler.runAfter(0, internal.mail.deliver, { messageId, viaEmail });
  // Actions are not retried: without this a dead delivery would leave the message queued for good.
  await ctx.scheduler.runAfter(QUEUED_WATCHDOG_MS, internal.mail.expireQueued, { messageId });
  return true;
}

// The Negotiator is an action, and actions are not retried: if one dies, nothing would ever move
// the thread off "drafting", and every renter control refuses while a draft is being written.
const DRAFT_WATCHDOG_MS = 3 * 60 * 1000;

function draftingMark(thread: Pick<Doc<"threads">, "renterNotes" | "lastMessageAt">): string {
  return `${thread.renterNotes.length}:${thread.lastMessageAt}`;
}

/** Schedules the Negotiator plus the watchdog for it. `thread` is the row as it is being left. */
export async function scheduleDraft(
  ctx: MutationCtx,
  thread: Pick<Doc<"threads">, "_id" | "renterNotes" | "lastMessageAt">,
  purpose: DraftPurpose,
  replacesMessageId?: Id<"messages">,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.negotiator.draft, { threadId: thread._id, purpose, replacesMessageId });
  await ctx.scheduler.runAfter(DRAFT_WATCHDOG_MS, internal.threads.expireDrafting, {
    threadId: thread._id,
    mark: draftingMark(thread),
  });
}

// Queries -------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const renter = await getRenter(ctx);
    if (renter === null) return [];
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_renter", (q) => q.eq("renterId", renter._id))
      .order("desc")
      .take(60);
    const drafts = await ctx.db
      .query("messages")
      .withIndex("by_renter_status", (q) => q.eq("renterId", renter._id).eq("status", "draft"))
      .take(120);
    const threadsWithDraft = new Set(drafts.map((m) => m.threadId));

    return await Promise.all(
      threads.map(async (thread) => {
        const listing = await ctx.db.get(thread.listingId);
        return {
          ...thread,
          pendingDraft: threadsWithDraft.has(thread._id),
          listing: listing && {
            _id: listing._id,
            title: listingName(listing),
            address: listing.address ?? null,
            rentMonthly: listing.rentMonthly ?? null,
            photo: listing.photos[0] ?? null,
          },
        };
      }),
    );
  },
});

export const forListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const renter = await getRenter(ctx);
    if (renter === null) return null;
    const listing = await ctx.db.get(listingId);
    if (listing === null || listing.renterId !== renter._id) return null;
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .first();
    if (thread === null) return null;

    const all = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(200);
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(50);
    return {
      thread,
      messages: all.filter((m) => m.status !== "discarded").slice(-100),
      tours: tours.sort((a, b) => a.startsAt - b.startsAt),
    };
  },
});

// Renter actions --------------------------------------------------------------------

async function startThread(
  ctx: MutationCtx,
  renter: Doc<"renters">,
  listing: Doc<"listings">,
  useDemoLandlord: boolean,
): Promise<Id<"threads">> {
  const existing = await ctx.db
    .query("threads")
    .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
    .first();
  if (existing) return existing._id;
  if (listing.status !== "ready") {
    throw new ConvexError("Nestor is still reading this listing. Try again in a moment.");
  }

  const isSimulated = listing.isSample || useDemoLandlord || !agentmailLive();
  let landlordEmail = listing.contactEmail?.trim();
  let landlordName = listing.contactName;
  if (isSimulated) {
    const sim = await ctx.db
      .query("mailboxes")
      .withIndex("by_role", (q) => q.eq("role", "landlord_sim"))
      .first();
    landlordEmail = sim?.email ?? DEMO_LANDLORD_ADDRESS;
    // A stable persona per listing, so reloading never renames the landlord.
    const seed = [...listing._id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const persona = DEMO_LANDLORD_NAMES[seed % DEMO_LANDLORD_NAMES.length];
    // A real person's name never goes on replies that Nestor made up.
    landlordName = listing.isSample ? (listing.contactName ?? persona) : persona;
  } else {
    if (!landlordEmail) {
      throw new ConvexError(
        "Add or find the landlord's email first. Nestor never guesses an address. You can also try the demo landlord.",
      );
    }
    if (renter.isGuest) {
      throw new ConvexError(
        "Create a free account to email real landlords. Guests can try the full flow with the demo landlord.",
      );
    }
    if (!inboundLive()) {
      throw new ConvexError("Nestor's inbox can't receive replies on this deployment yet. Try the demo landlord.");
    }
  }

  const now = Date.now();
  const threadId = await ctx.db.insert("threads", {
    renterId: renter._id,
    listingId: listing._id,
    stage: "drafting",
    isSimulated,
    landlordName,
    landlordEmail,
    subject: `Inquiry about ${listingName(listing)}`.slice(0, 140),
    rentAsked: listing.rentMonthly,
    concessionsWon: [],
    openQuestions: [],
    renterNotes: [],
    lastMessageAt: now,
    unread: false,
  });
  await logActivity(ctx, {
    renterId: renter._id,
    kind: "negotiator",
    title: `Writing a first email about ${listingName(listing)}`,
    detail: isSimulated
      ? "Demo landlord: Nestor plays the other side so you can see the whole flow."
      : `It will go to ${landlordEmail} once you approve it.`,
    listingId: listing._id,
    threadId,
  });
  await scheduleDraft(ctx, { _id: threadId, renterNotes: [], lastMessageAt: now }, "initial_inquiry");
  return threadId;
}

export const start = mutation({
  args: { listingId: v.id("listings"), useDemoLandlord: v.optional(v.boolean()) },
  returns: v.id("threads"),
  handler: async (ctx, { listingId, useDemoLandlord }) => {
    const { renter, doc: listing } = await requireOwned(ctx, "listings", listingId);
    return await startThread(ctx, renter, listing, useDemoLandlord ?? false);
  },
});

async function approve(
  ctx: MutationCtx,
  renter: Doc<"renters">,
  message: Doc<"messages">,
  edits: { subject?: string; body?: string },
): Promise<void> {
  if (message.direction !== "outbound" || message.status !== "draft") {
    throw new ConvexError("This draft was already sent or replaced.");
  }
  const thread = await ctx.db.get(message.threadId);
  if (thread === null) throw new ConvexError("Not found.");
  if (OVER.has(thread.stage)) throw new ConvexError("This conversation is closed.");
  const sent = await sentOutboundCount(ctx, thread._id);
  if (sent >= MAX_OUTBOUND_PER_THREAD) {
    throw new ConvexError(
      `Nestor stops after ${MAX_OUTBOUND_PER_THREAD} emails in one conversation. Pick it up from your own inbox from here.`,
    );
  }

  const subject = edits.subject !== undefined ? cleanText(edits.subject, 200, "The subject") : message.subject;
  let body = message.body;
  if (edits.body !== undefined && edits.body.trim() !== message.body.trim()) {
    body = cleanText(edits.body, 6000, "The email");
    if (!thread.isSimulated) {
      // Real landlords get the same hard rules as the Negotiator's own drafts, and no link farms.
      const problems = policyViolations(body, renter);
      if (problems.length > 0) throw new ConvexError(`Nestor can't send this email: ${problems.join("; ")}.`);
      const links = (body.match(/https?:\/\/\S+/gi) ?? []).filter((url) => !url.includes("/passport/"));
      if (links.length > 2) throw new ConvexError("Nestor can't send an email with more than two links.");
    }
  }
  // The renter may say anything else in their own email, except hide that an AI is writing it.
  body = ensureDisclosure(body, renter, sent === 0);
  await ctx.db.patch(message._id, { subject, body });
  await queueDelivery(ctx, renter, thread, message._id, true);
}

export const approveDraft = mutation({
  args: { messageId: v.id("messages"), subject: v.optional(v.string()), body: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { messageId, subject, body }) => {
    const { renter, doc: message } = await requireOwned(ctx, "messages", messageId);
    await approve(ctx, renter, message, { subject, body });
    return null;
  },
});

export const discardDraft = mutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const { doc: message } = await requireOwned(ctx, "messages", messageId);
    if (message.status !== "draft") throw new ConvexError("This draft was already sent or replaced.");
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;

    const everything = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(200);
    const hasHistory = everything.some((m) => m.status === "sent" || m.status === "received" || m.status === "queued");
    if (!hasHistory) {
      // Nothing ever left: remove the empty conversation so the listing can be started again.
      for (const m of everything) await ctx.db.delete(m._id);
      await ctx.db.delete(thread._id);
      return null;
    }
    await ctx.db.patch(message._id, { status: "discarded" });
    await ctx.db.patch(thread._id, { stage: await restingStage(ctx, thread) });
    return null;
  },
});

/** Shared by redraft and answerQuestions: save the renter's words, drop the old draft, write a new one. */
async function rewrite(
  ctx: MutationCtx,
  thread: Doc<"threads">,
  note: string,
  purposeWhenFresh: DraftPurpose,
  patch: Partial<Doc<"threads">> = {},
): Promise<void> {
  if (OVER.has(thread.stage)) throw new ConvexError("This conversation is closed.");
  if (thread.stage === "drafting") throw new ConvexError("Nestor is already writing. Give it a moment.");
  const replaced = await discardDrafts(ctx, thread._id);
  const sent = await sentOutboundCount(ctx, thread._id);
  const renterNotes = [...thread.renterNotes, note].slice(-20);
  await ctx.db.patch(thread._id, { ...patch, stage: "drafting", renterNotes });
  await scheduleDraft(
    ctx,
    { _id: thread._id, renterNotes, lastMessageAt: thread.lastMessageAt },
    replaced ? "revise" : sent === 0 ? "initial_inquiry" : purposeWhenFresh,
    replaced?._id,
  );
}

export const redraft = mutation({
  args: { threadId: v.id("threads"), instruction: v.string() },
  returns: v.null(),
  handler: async (ctx, { threadId, instruction }) => {
    const { doc: thread } = await requireOwned(ctx, "threads", threadId);
    await rewrite(ctx, thread, cleanText(instruction, 500, "Your instruction"), "follow_up");
    return null;
  },
});

export const answerQuestions = mutation({
  args: { threadId: v.id("threads"), answer: v.string() },
  returns: v.null(),
  handler: async (ctx, { threadId, answer }) => {
    const { renter, doc: thread } = await requireOwned(ctx, "threads", threadId);
    const text = cleanText(answer, 800, "Your answer");
    // The questions themselves are landlord text, so they stay out of the renter's instructions.
    await rewrite(ctx, thread, `My answer to the landlord's questions: ${text}`, "answer_questions", {
      openQuestions: [],
    });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "negotiator",
      title: "Got your answers, writing the reply",
      listingId: thread.listingId,
      threadId,
    });
    return null;
  },
});

export const markRead = mutation({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, { threadId }) => {
    const { doc: thread } = await requireOwned(ctx, "threads", threadId);
    if (thread.unread) await ctx.db.patch(threadId, { unread: false });
    return null;
  },
});

export const close = mutation({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, { threadId }) => {
    const { renter, doc: thread } = await requireOwned(ctx, "threads", threadId);
    if (thread.stage === "closed") return null;
    await discardDrafts(ctx, threadId);
    await ctx.db.patch(threadId, { stage: "closed", unread: false, openQuestions: [] });
    const listing = await ctx.db.get(thread.listingId);
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "negotiator",
      title: `Closed the conversation about ${listingName(listing)}`,
      detail: "Nestor will not write or send anything more here.",
      listingId: thread.listingId,
      threadId,
    });
    return null;
  },
});

// Internal: called by the Negotiator, the mailer and the demo landlord ------------------

export const draftContext = internalQuery({
  args: { threadId: v.id("threads"), replacesMessageId: v.optional(v.id("messages")) },
  handler: async (ctx, { threadId, replacesMessageId }) => {
    const thread = await ctx.db.get(threadId);
    if (thread === null) return null;
    const [renter, listing] = await Promise.all([ctx.db.get(thread.renterId), ctx.db.get(thread.listingId)]);
    if (renter === null || listing === null) return null;

    const recent = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("desc")
      .take(60);
    const exchanged = recent.filter((m) => m.status === "sent" || m.status === "received");
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .take(50);
    const replaced = replacesMessageId ? await ctx.db.get(replacesMessageId) : null;
    return {
      renter,
      listing,
      thread,
      messages: exchanged.slice(0, 12).reverse(),
      tours: tours.sort((a, b) => a.startsAt - b.startsAt),
      sentCount: exchanged.filter((m) => m.direction === "outbound").length,
      previousDraft: replaced && replaced.threadId === threadId ? replaced.body : null,
    };
  },
});

export const saveDraft = internalMutation({
  args: {
    threadId: v.id("threads"),
    subject: v.string(),
    body: v.string(),
    rationale: v.string(),
    // Optional so a caller that does not know stays valid; the UI then makes no claim.
    source: v.optional(draftSource),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, subject, body, rationale, source }) => {
    const thread = await ctx.db.get(threadId);
    if (thread === null || OVER.has(thread.stage)) return null;
    const renter = await ctx.db.get(thread.renterId);
    if (renter === null) return null;

    await discardDrafts(ctx, threadId);
    const agent = await ctx.db
      .query("mailboxes")
      .withIndex("by_role", (q) => q.eq("role", "agent"))
      .first();
    const messageId = await ctx.db.insert("messages", {
      threadId,
      renterId: renter._id,
      direction: "outbound",
      status: "draft",
      // Settled at delivery: a demo thread may still travel over real email.
      channel: thread.isSimulated && !agentmailLive() ? "simulated" : "agentmail",
      fromAddress: agent?.email ?? "Nestor's inbox",
      toAddress: thread.landlordEmail,
      subject,
      body,
      rationale,
      draftSource: source,
    });

    const queued = renter.autopilot && (await queueDelivery(ctx, renter, thread, messageId, false));
    if (!queued) await ctx.db.patch(threadId, { stage: "needs_approval" });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "negotiator",
      title: queued ? `Autopilot is sending "${subject}"` : `Draft ready for your OK: "${subject}"`,
      detail: queued
        ? rationale
        : renter.autopilot
          ? "Autopilot paused: today's email limit is reached, so this one waits for you."
          : rationale,
      listingId: thread.listingId,
      threadId,
    });
    return null;
  },
});

/** The Negotiator had nothing to write (email cap reached): park the thread where it belongs. */
export const settle = internalMutation({
  args: { threadId: v.id("threads"), title: v.string(), detail: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { threadId, title, detail }) => {
    const thread = await ctx.db.get(threadId);
    if (thread === null) return null;
    await ctx.db.patch(threadId, { stage: await restingStage(ctx, thread) });
    await logActivity(ctx, {
      renterId: thread.renterId,
      kind: "negotiator",
      title,
      detail,
      listingId: thread.listingId,
      threadId,
    });
    return null;
  },
});

/** Scheduled with every draft. Frees a thread whose Negotiator run never reported back. */
export const expireDrafting = internalMutation({
  args: { threadId: v.id("threads"), mark: v.string() },
  returns: v.null(),
  handler: async (ctx, { threadId, mark }) => {
    const thread = await ctx.db.get(threadId);
    // A different mark means the renter or the landlord moved the thread on; that run has its own watchdog.
    if (thread === null || thread.stage !== "drafting" || draftingMark(thread) !== mark) return null;
    const listing = await ctx.db.get(thread.listingId);
    const base = { renterId: thread.renterId, kind: "system" as const, listingId: thread.listingId };

    if ((await sentOutboundCount(ctx, threadId)) === 0 && thread.lastInboundAt === undefined) {
      // Nothing was ever sent, so the empty conversation goes and the listing can be started again.
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .take(200);
      for (const message of messages) await ctx.db.delete(message._id);
      await ctx.db.delete(threadId);
      await logActivity(ctx, {
        ...base,
        title: `The first email about ${listingName(listing)} was never finished`,
        detail: "Nothing was sent. Start the conversation again from the listing.",
      });
      return null;
    }
    await ctx.db.patch(threadId, { stage: await restingStage(ctx, thread) });
    await logActivity(ctx, {
      ...base,
      threadId,
      title: `The next email about ${listingName(listing)} was never finished`,
      detail: "Nothing was sent. Tell the Negotiator what to say and it will try again.",
    });
    return null;
  },
});

export const inboundContext = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (message === null || message.direction !== "inbound") return null;
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;
    const [renter, listing] = await Promise.all([ctx.db.get(thread.renterId), ctx.db.get(thread.listingId)]);
    if (renter === null || listing === null) return null;
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .take(40);
    const lastOutbound = recent.find((m) => m.direction === "outbound" && m.status === "sent");
    return { message, thread, renter, listing, lastOutboundBody: lastOutbound?.body ?? null };
  },
});

/** The same concession worded two ways gets the same key: no figures, no filler, no word order. */
function concessionKey(concession: string): string {
  const words = concession
    .toLowerCase()
    .replace(/\$\s?[\d,.]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !["the", "a", "an", "is", "was", "will", "be", "of", "for", "on"].includes(w))
    .map((w) => w.replace(/^waiv\w*$/, "waived").replace(/^reduc\w*$/, "reduced"));
  return [...new Set(words)].sort().join(" ") || concession.toLowerCase();
}

/**
 * Applies what the Negotiator understood from one landlord email. Everything
 * here is reversible bookkeeping: offers are recorded, never accepted, and a
 * tour stays "proposed" until the renter picks it.
 */
export const applyAnalysis = internalMutation({
  args: { messageId: v.id("messages"), analysis: replyAnalysis },
  returns: v.null(),
  handler: async (ctx, { messageId, analysis }) => {
    const message = await ctx.db.get(messageId);
    if (message === null || message.analysis !== undefined) return null;
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;
    const listing = await ctx.db.get(thread.listingId);
    const now = Date.now();
    const firstName = thread.landlordName?.split(/\s+/)[0] ?? "The landlord";
    const who = thread.isSimulated ? `${firstName} (demo landlord)` : firstName;
    const base = { renterId: thread.renterId, listingId: thread.listingId, threadId: thread._id };

    await ctx.db.patch(messageId, { analysis });
    // A closed or declined conversation records what arrived and never re-opens.
    if (OVER.has(thread.stage)) return null;

    const existingTours = await ctx.db
      .query("tours")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(50);
    const newSlots = analysis.tourSlots.filter(
      (slot) => slot.startsAt > now - 3_600_000 && !existingTours.some((t) => t.startsAt === slot.startsAt),
    );
    const hasConfirmedTour = existingTours.some((t) => t.status === "confirmed");
    if (analysis.intent !== "rejection") {
      for (const slot of newSlots) {
        await ctx.db.insert("tours", { ...base, startsAt: slot.startsAt, label: slot.label, status: "proposed" });
      }
      if (newSlots.length > 0) {
        await logActivity(ctx, {
          ...base,
          kind: "tour",
          title: `${who} offered ${newSlots.map((s) => s.label).join(" or ")}`,
          detail: "Pick the time that suits you and Nestor will confirm it.",
        });
      }
    }

    const asked = thread.rentAsked ?? listing?.rentMonthly;
    // A figure far under asking is a misread one-time discount, not a monthly rent.
    const offered =
      analysis.rentOffered !== undefined && (asked === undefined || analysis.rentOffered >= asked * 0.6)
        ? analysis.rentOffered
        : undefined;
    const bestSoFar = thread.rentBestOffer ?? asked;
    const improved = offered !== undefined && (bestSoFar === undefined || offered < bestSoFar);
    if (improved && offered !== undefined) {
      await logActivity(ctx, {
        ...base,
        kind: "landlord",
        title:
          asked !== undefined && offered < asked
            ? `${who} offered ${dollars(offered)} a month, ${dollars(asked - offered)} under asking`
            : `${who} quoted ${dollars(offered)} a month`,
      });
    }

    // A later email often restates an earlier concession in other words ("$40 application fee
    // waived", then "Application fee waived"). Compared without figures or word order, so one
    // win is not logged twice.
    const known = new Set(thread.concessionsWon.map(concessionKey));
    const newConcessions = analysis.concessions.filter((c) => {
      const key = concessionKey(c);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (newConcessions.length > 0) {
      await logActivity(ctx, { ...base, kind: "landlord", title: `${who} agreed: ${newConcessions.join(", ")}` });
    }

    // New times after the renter already picked one mean the landlord moved the tour, not confirmed it.
    // Only mail that is about the tour (or agrees to something) counts: a cancellation or an
    // unrelated note must not be logged as a confirmation.
    const restatesConfirmed = analysis.tourSlots.some((s) =>
      existingTours.some((t) => t.status === "confirmed" && t.startsAt === s.startsAt),
    );
    const confirmsTour =
      hasConfirmedTour &&
      newSlots.length === 0 &&
      analysis.sentiment !== "negative" &&
      (restatesConfirmed ||
        analysis.intent === "tour_offer" ||
        analysis.intent === "acceptance" ||
        analysis.intent === "counter_offer");
    const sentCount = await sentOutboundCount(ctx, thread._id);
    const awaitingTourChoice =
      newSlots.length > 0 || (!hasConfirmedTour && existingTours.some((t) => t.status === "proposed"));

    let stage: ThreadStage = "negotiating";
    if (analysis.intent === "rejection") stage = "declined";
    else if (confirmsTour) stage = "tour_scheduled";
    else if (analysis.intent === "acceptance" && analysis.tourSlots.length === 0) stage = "terms_agreed";

    await ctx.db.patch(thread._id, {
      stage,
      rentBestOffer: improved ? offered : thread.rentBestOffer,
      concessionsWon: [...thread.concessionsWon, ...newConcessions].slice(0, 12),
      openQuestions: analysis.intent === "rejection" ? [] : analysis.questionsForRenter,
    });

    if (analysis.intent === "rejection") {
      for (const tour of existingTours) {
        if (tour.status === "proposed") await ctx.db.patch(tour._id, { status: "declined" });
      }
      await discardDrafts(ctx, thread._id);
      await logActivity(ctx, { ...base, kind: "landlord", title: `${who} said ${listingName(listing)} is no longer available`, detail: analysis.summary });
      return null;
    }

    if (analysis.questionsForRenter.length > 0) {
      await logActivity(ctx, {
        ...base,
        kind: "negotiator",
        title: `${who} asked something only you can answer`,
        detail: analysis.questionsForRenter.join(" "),
      });
      return null;
    }

    const nothingNewToDiscuss = !improved && newConcessions.length === 0;
    if (confirmsTour && nothingNewToDiscuss) {
      const tour = existingTours.find((t) => t.status === "confirmed");
      await logActivity(ctx, { ...base, kind: "tour", title: `${who} confirmed your tour${tour ? ` on ${tour.label}` : ""}`, detail: analysis.summary });
      return null;
    }
    if (stage === "terms_agreed") {
      await logActivity(ctx, { ...base, kind: "landlord", title: `${who} agreed to the terms`, detail: `${analysis.summary} Nothing is signed: the next step is yours.` });
      return null;
    }
    // Once the asks are out, the only open item is the renter's choice of tour time.
    if (awaitingTourChoice && sentCount >= 2) return null;
    if (sentCount >= MAX_OUTBOUND_PER_THREAD) return null;

    // Auto-replies and pleasantries get no answer, or autopilot would keep a loop going.
    const actionable =
      newSlots.length > 0 ||
      improved ||
      newConcessions.length > 0 ||
      analysis.intent === "tour_offer" ||
      analysis.intent === "counter_offer" ||
      analysis.intent === "question" ||
      analysis.intent === "acceptance";
    if (!actionable) {
      await ctx.db.patch(thread._id, { stage: await restingStage(ctx, thread) });
      await logActivity(ctx, {
        ...base,
        kind: "landlord",
        title: `${who} wrote back, nothing for Nestor to answer`,
        detail: analysis.summary,
      });
      return null;
    }

    await ctx.db.patch(thread._id, { stage: "drafting" });
    await scheduleDraft(ctx, thread, "follow_up");
    return null;
  },
});

// CLI-only entry points, for driving a conversation without a signed-in user:
//   npx convex run threads:devStart '{"renterId":"...","listingId":"...","useDemoLandlord":true}'

export const devStart = internalMutation({
  args: { renterId: v.id("renters"), listingId: v.id("listings"), useDemoLandlord: v.optional(v.boolean()) },
  returns: v.id("threads"),
  handler: async (ctx, { renterId, listingId, useDemoLandlord }) => {
    const [renter, listing] = await Promise.all([ctx.db.get(renterId), ctx.db.get(listingId)]);
    if (renter === null || listing === null || listing.renterId !== renterId) throw new ConvexError("Not found.");
    return await startThread(ctx, renter, listing, useDemoLandlord ?? false);
  },
});

export const devApprove = internalMutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    const renter = message && (await ctx.db.get(message.renterId));
    if (!message || !renter) throw new ConvexError("Not found.");
    await approve(ctx, renter, message, {});
    return null;
  },
});

export const devSnapshot = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (thread === null) return null;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .take(200);
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .take(50);
    const activity = await ctx.db
      .query("activity")
      .withIndex("by_renter", (q) => q.eq("renterId", thread.renterId))
      .order("desc")
      .take(40);
    return {
      thread,
      messages,
      tours,
      activity: activity.filter((a) => a.threadId === threadId).reverse().map((a) => `[${a.kind}] ${a.title}`),
    };
  },
});
