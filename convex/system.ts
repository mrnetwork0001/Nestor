import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  agentmailLive,
  agentmailPolling,
  firecrawlLive,
  openaiLive,
  webhookVerified,
} from "./lib/integrations";

/** Which integrations are live, for the status badges. Exposes no secrets. */
export const status = query({
  args: {},
  returns: v.object({
    firecrawl: v.boolean(),
    agentmail: v.boolean(),
    openai: v.boolean(),
    inboundMode: v.union(v.literal("webhook"), v.literal("polling"), v.literal("off")),
    agentInbox: v.union(v.string(), v.null()),
    // A key alone does not mean mail can flow: the two inboxes must exist too.
    inboxReady: v.boolean(),
  }),
  handler: async (ctx) => {
    const agent = await ctx.db
      .query("mailboxes")
      .withIndex("by_role", (q) => q.eq("role", "agent"))
      .first();
    return {
      firecrawl: firecrawlLive(),
      agentmail: agentmailLive(),
      openai: openaiLive(),
      inboundMode: !agentmailLive()
        ? ("off" as const)
        : agentmailPolling()
          ? ("polling" as const)
          : webhookVerified()
            ? ("webhook" as const)
            : ("off" as const),
      agentInbox: agent?.email ?? null,
      inboxReady: agentmailLive() && agent !== null,
    };
  },
});
