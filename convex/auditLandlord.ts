import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import {
  bareAddress,
  createInbox,
  getMessage,
  listInboxes,
  listMessages,
  replyToMessage,
} from "./agentmailApi";
import { agentmailLive } from "./lib/integrations";

/*
 * A stand-in landlord for testing the REAL conversation path without writing
 * to a stranger. It is a third AgentMail inbox that Nestor knows nothing
 * about: no mailbox row, no webhook subscription, no demo-landlord script. To
 * the app it is an ordinary outside address, so a conversation with it takes
 * exactly the path a real landlord's would (isSimulated = false), and the
 * replies here are typed by whoever runs the test.
 *
 *   npx convex run auditLandlord:run '{"op":"ensure"}'          -> its address
 *   npx convex run auditLandlord:run '{"op":"inbox"}'           -> what the "landlord" received
 *   npx convex run auditLandlord:run '{"op":"reply","text":"..."}'
 *
 * Internal only: not reachable from clients.
 */

const SPEC = {
  username: "nestor-audit-landlord",
  displayName: "Audit Landlord",
  clientId: "nestor-audit-landlord-v1",
};

async function auditInbox() {
  const existing = (await listInboxes()).find(
    (box) => box.client_id === SPEC.clientId || box.inbox_id.toLowerCase().startsWith(`${SPEC.username}@`),
  );
  if (existing) return existing;
  try {
    return await createInbox(SPEC);
  } catch (e) {
    // The free tier allows three inboxes. When the account is full, borrow the one that is not Nestor's.
    const spare = (await listInboxes()).find((box) => !/^nestor-(concierge|demo-landlord)@/i.test(box.inbox_id));
    if (!spare) throw e;
    return spare;
  }
}

export const run = internalAction({
  args: {
    op: v.union(v.literal("list"), v.literal("ensure"), v.literal("inbox"), v.literal("reply")),
    text: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    if (!agentmailLive()) throw new Error("AgentMail is not connected on this deployment.");
    if (args.op === "list") {
      return (await listInboxes()).map((box) => ({ inbox: box.inbox_id, name: box.display_name ?? null, clientId: box.client_id ?? null }));
    }
    const inbox = await auditInbox();
    if (args.op === "ensure") return { address: inbox.inbox_id };

    const items = await listMessages(inbox.inbox_id, 10);
    const received = items.filter((item) => item.labels?.includes("received"));

    if (args.op === "inbox") {
      const messages = [];
      for (const item of received.slice(0, 3)) {
        const raw = await getMessage(inbox.inbox_id, item.message_id);
        const text = String(raw.extracted_text ?? raw.text ?? "");
        messages.push({
          from: bareAddress(String(raw.from ?? "")),
          subject: String(raw.subject ?? ""),
          receivedAt: String(raw.timestamp ?? item.timestamp ?? ""),
          labels: item.labels ?? [],
          text: text.slice(0, 1600),
        });
      }
      return { address: inbox.inbox_id, received: received.length, messages };
    }

    const newest = received[0];
    if (!newest) throw new Error("The audit landlord has not received anything to reply to.");
    if (!args.text?.trim()) throw new Error("Give the reply text.");
    const sent = await replyToMessage({
      inboxId: inbox.inbox_id,
      parentMessageId: newest.message_id,
      text: args.text.trim(),
      // AgentMail allows only A-Z a-z 0-9 - . _ ~ in the key, and a Message-ID has < > and @.
      idempotencyKey: `audit-reply-${newest.message_id.replace(/[^A-Za-z0-9._~-]/g, "")}-${args.text.trim().length}`.slice(0, 120),
    });
    return { repliedTo: newest.message_id.slice(0, 24), sent: Boolean(sent.message_id) };
  },
});
