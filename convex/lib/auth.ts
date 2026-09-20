import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/*
 * Every renter-facing function derives identity here. Functions never accept a
 * userId or renterId argument for authorization.
 */

type Ctx = QueryCtx | MutationCtx;

export async function requireUserId(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Please sign in first.");
  return userId;
}

/** The signed-in user's renter profile, or null before onboarding. */
export async function getRenter(ctx: Ctx): Promise<Doc<"renters"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db
    .query("renters")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireRenter(ctx: Ctx): Promise<Doc<"renters">> {
  const renter = await getRenter(ctx);
  if (renter === null) throw new ConvexError("Finish setting up your profile first.");
  return renter;
}

/** Loads a document and checks it belongs to the signed-in renter. */
export async function requireOwned<
  T extends "listings" | "threads" | "messages" | "tours" | "leaseAudits",
>(ctx: Ctx, _table: T, id: Id<T>): Promise<{ renter: Doc<"renters">; doc: Doc<T> }> {
  const renter = await requireRenter(ctx);
  // Every table in T carries renterId; the generic hides that from the checker.
  const doc = (await ctx.db.get(id)) as unknown as (Doc<T> & { renterId: Id<"renters"> }) | null;
  if (doc === null || doc.renterId !== renter._id) {
    throw new ConvexError("Not found.");
  }
  return { renter, doc };
}
