import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Anonymous = one-click guest demo. Password = email + password, no verification.
  providers: [Anonymous, Password],
  callbacks: {
    async createOrUpdateUser(ctx: MutationCtx, args) {
      if (args.existingUserId) return args.existingUserId;

      // Guest upgrade: a guest who creates an account keeps the same users row,
      // so their listings, threads and audits stay attached.
      const currentUserId = await getAuthUserId(ctx);
      if (currentUserId !== null && args.provider.id !== "anonymous") {
        const current = await ctx.db.get(currentUserId);
        if (current !== null && current.isAnonymous === true) {
          await ctx.db.patch(currentUserId, {
            isAnonymous: false,
            email: args.profile.email,
          });
          // renters.isGuest mirrors users.isAnonymous and gates email to real landlords.
          const renter = await ctx.db
            .query("renters")
            .withIndex("by_user", (q) => q.eq("userId", currentUserId))
            .unique();
          if (renter !== null && renter.isGuest) await ctx.db.patch(renter._id, { isGuest: false });
          return currentUserId;
        }
      }

      const { emailVerified: _e, phoneVerified: _p, ...profile } = args.profile;
      return await ctx.db.insert("users", profile as never);
    },
  },
});
