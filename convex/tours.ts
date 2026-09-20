import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { logActivity } from "./activity";
import { getRenter, requireOwned } from "./lib/auth";
import { restingStage, scheduleDraft } from "./threads";

/*
 * Tours come out of landlord emails as "proposed". Only the renter can turn
 * one into "confirmed", and the Negotiator then writes the confirmation email.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const renter = await getRenter(ctx);
    if (renter === null) return [];
    // Newest 50 by start time, returned soonest first: old tours fall off, upcoming ones never do.
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_renter", (q) => q.eq("renterId", renter._id))
      .order("desc")
      .take(50);
    const rows = await Promise.all(
      tours.map(async (tour) => {
        const listing = await ctx.db.get(tour.listingId);
        return {
          ...tour,
          listing: listing && {
            _id: listing._id,
            title: listing.title ?? listing.address ?? "Rental listing",
            address: listing.address ?? null,
          },
        };
      }),
    );
    return rows.reverse();
  },
});

async function chooseTour(ctx: MutationCtx, tour: Doc<"tours">): Promise<void> {
  if (tour.status === "confirmed") return;
  if (tour.status !== "proposed") throw new ConvexError("This tour time is no longer on offer.");
  const thread = await ctx.db.get(tour.threadId);
  if (thread === null) throw new ConvexError("Not found.");
  if (thread.stage === "declined" || thread.stage === "closed") {
    throw new ConvexError("This conversation is closed.");
  }
  if (thread.stage === "drafting") throw new ConvexError("Nestor is writing right now. Try again in a moment.");

  const siblings = await ctx.db
    .query("tours")
    .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
    .take(50);
  for (const other of siblings) {
    if (other._id === tour._id) continue;
    // Choosing a new time also replaces a time picked earlier.
    if (other.status === "proposed" || other.status === "confirmed") {
      await ctx.db.patch(other._id, { status: "declined" });
    }
  }
  await ctx.db.patch(tour._id, { status: "confirmed" });

  // Any pending draft was written before this choice, so it is replaced.
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
    .take(200);
  for (const message of messages) {
    if (message.status === "draft") await ctx.db.patch(message._id, { status: "discarded" });
  }

  // The label is the landlord's wording, so it stays out of the renter's instructions; the
  // Negotiator reads the chosen time from the tour row. "drafting" keeps this single-flight.
  const renterNotes = [...thread.renterNotes, "Confirm the tour time I chose"].slice(-20);
  await ctx.db.patch(thread._id, { stage: "drafting", renterNotes });
  await logActivity(ctx, {
    renterId: tour.renterId,
    kind: "tour",
    title: `You picked ${tour.label}`,
    detail: "Nestor is writing to the landlord to confirm it.",
    listingId: tour.listingId,
    threadId: thread._id,
  });
  await scheduleDraft(ctx, { _id: thread._id, renterNotes, lastMessageAt: thread.lastMessageAt }, "confirm_tour");
}

export const choose = mutation({
  args: { tourId: v.id("tours") },
  returns: v.null(),
  handler: async (ctx, { tourId }) => {
    const { doc: tour } = await requireOwned(ctx, "tours", tourId);
    await chooseTour(ctx, tour);
    return null;
  },
});

export const decline = mutation({
  args: { tourId: v.id("tours") },
  returns: v.null(),
  handler: async (ctx, { tourId }) => {
    const { doc: tour } = await requireOwned(ctx, "tours", tourId);
    if (tour.status === "declined") return null;
    if (tour.status === "completed") throw new ConvexError("This tour already happened.");
    const wasConfirmed = tour.status === "confirmed";
    await ctx.db.patch(tourId, { status: "declined" });
    if (!wasConfirmed) return null;

    const thread = await ctx.db.get(tour.threadId);
    if (thread === null) return null;
    if (thread.stage === "tour_scheduled") {
      await ctx.db.patch(thread._id, { stage: await restingStage(ctx, thread) });
    }
    await logActivity(ctx, {
      renterId: tour.renterId,
      kind: "tour",
      title: `You cancelled the tour on ${tour.label}`,
      detail: "Tell the Negotiator what to say and it will let the landlord know.",
      listingId: tour.listingId,
      threadId: thread._id,
    });
    return null;
  },
});

// CLI-only: npx convex run tours:devChoose '{"tourId":"..."}'
export const devChoose = internalMutation({
  args: { tourId: v.id("tours") },
  returns: v.null(),
  handler: async (ctx, { tourId }) => {
    const tour = await ctx.db.get(tourId);
    if (tour === null) throw new ConvexError("Not found.");
    await chooseTour(ctx, tour);
    return null;
  },
});
