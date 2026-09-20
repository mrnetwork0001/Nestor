import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/*
 * Internal-only helpers for exercising the backend from the CLI, where there
 * is no signed-in user:
 *
 *   npx convex run devtools:seedRenter '{}'
 *
 * Internal functions are not reachable from clients.
 */

export const seedRenter = internalMutation({
  args: { city: v.optional(v.string()), guest: v.optional(v.boolean()) },
  returns: v.object({ userId: v.id("users"), renterId: v.id("renters") }),
  handler: async (ctx, { city, guest }) => {
    const existing = await ctx.db
      .query("renters")
      .withIndex("by_passport_token", (q) => q.eq("passportToken", "devseed0000000000000000000000000"))
      .unique();
    if (existing) return { userId: existing.userId, renterId: existing._id };

    const userId = await ctx.db.insert("users", {
      name: "Dev Seed",
      isAnonymous: guest ?? false,
    });
    const renterId = await ctx.db.insert("renters", {
      userId,
      isGuest: guest ?? false,
      displayName: "Jordan Avery",
      headline: "Product designer relocating for work",
      occupation: "Product designer",
      city: city ?? "Austin, TX",
      neighborhoods: ["East Austin", "Hyde Park"],
      budgetMin: 1600,
      budgetMax: 2400,
      bedroomsMin: 1,
      moveInDate: "2026-11-01",
      leaseTermMonths: 12,
      mustHaves: ["In-unit laundry", "Pet friendly"],
      creditBand: "good",
      incomeBand: "8k_12k",
      pets: { hasPets: true, description: "One 30lb beagle, house-trained" },
      occupants: 1,
      smoker: false,
      hasRentalHistory: true,
      passportToken: "devseed0000000000000000000000000",
      passportViews: 0,
      negotiationGoals: ["lower_rent", "waive_pet_fee", "flexible_move_in"],
      autopilot: false,
    });
    return { userId, renterId };
  },
});
