import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { getRenter } from "./lib/auth";
import { activityKind, type ActivityKind } from "./lib/validators";

/*
 * The live feed of what Nestor's agents are doing. Every agent step writes one
 * line here, and the dashboard subscribes to it.
 */

export type ActivityEntry = {
  renterId: Id<"renters">;
  kind: ActivityKind;
  title: string;
  detail?: string;
  listingId?: Id<"listings">;
  threadId?: Id<"threads">;
};

/** Call from mutations. Actions use `internal.activity.log` instead. */
export async function logActivity(ctx: MutationCtx, entry: ActivityEntry): Promise<void> {
  await ctx.db.insert("activity", entry);
}

export const log = internalMutation({
  args: {
    renterId: v.id("renters"),
    kind: activityKind,
    title: v.string(),
    detail: v.optional(v.string()),
    listingId: v.optional(v.id("listings")),
    threadId: v.optional(v.id("threads")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await logActivity(ctx, args);
    return null;
  },
});

export const feed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const renter = await getRenter(ctx);
    if (renter === null) return [];
    return await ctx.db
      .query("activity")
      .withIndex("by_renter", (q) => q.eq("renterId", renter._id))
      .order("desc")
      .take(Math.min(Math.max(limit ?? 40, 1), 100));
  },
});
