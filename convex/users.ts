import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * The signed-in user, or null. Guests are real users with `isAnonymous: true`;
 * the client uses that to offer "create an account" instead of "sign in".
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.union(v.string(), v.null()),
      isAnonymous: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    return {
      _id: user._id,
      email: user.email ?? null,
      isAnonymous: user.isAnonymous === true,
    };
  },
});
