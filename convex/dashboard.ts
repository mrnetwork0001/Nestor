import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { getRenter } from "./lib/auth";
import type { ThreadStage } from "./lib/validators";

/*
 * The stat row at the top of the dashboard. Every read is indexed and bounded,
 * so the numbers saturate at the caps below rather than scanning a table; a
 * single renter's search stays far under them.
 */

const MAX_LISTINGS = 200;
const MAX_THREADS = 100;
const MAX_MESSAGES = 300;
const MAX_TOURS = 100;

// An offer from a landlord who said no, or a conversation the renter ended, is off the table.
const OVER: ReadonlySet<ThreadStage> = new Set<ThreadStage>(["declined", "closed"]);

const summaryShape = v.object({
  listings: v.number(),
  inquiriesSent: v.number(), // landlords Nestor has actually emailed
  replies: v.number(), // landlord emails received
  toursBooked: v.number(),
  monthlySavings: v.number(), // sum of (asked - best offer) across live conversations
  // The share of the two results above that came from Nestor's demo landlord, so the tiles can say so.
  // Both are already counted in toursBooked and monthlySavings; they are never added on top.
  toursBookedDemo: v.number(),
  monthlySavingsDemo: v.number(),
  // Things a landlord agreed to that are not a lower rent (a waived fee, free parking), which
  // monthlySavings cannot show. concessionsWonDemo is the part won from the demo landlord.
  concessionsWon: v.number(),
  concessionsWonDemo: v.number(),
  needsYou: v.number(),
  needsYouBreakdown: v.object({
    drafts: v.number(),
    questions: v.number(),
    tours: v.number(),
  }),
});

export const summary = query({
  args: {},
  returns: summaryShape,
  handler: async (ctx) => {
    const renter = await getRenter(ctx);
    // Signed out, or not onboarded yet: the same shape, all zeros.
    if (renter === null) {
      return {
        listings: 0,
        inquiriesSent: 0,
        replies: 0,
        toursBooked: 0,
        monthlySavings: 0,
        toursBookedDemo: 0,
        monthlySavingsDemo: 0,
        concessionsWon: 0,
        concessionsWonDemo: 0,
        needsYou: 0,
        needsYouBreakdown: { drafts: 0, questions: 0, tours: 0 },
      };
    }
    const renterId = renter._id;

    const [listings, threads, sent, received, drafts, tours] = await Promise.all([
      ctx.db
        .query("listings")
        .withIndex("by_renter", (q) => q.eq("renterId", renterId).eq("archived", false))
        .take(MAX_LISTINGS),
      ctx.db
        .query("threads")
        .withIndex("by_renter", (q) => q.eq("renterId", renterId))
        .order("desc")
        .take(MAX_THREADS),
      ctx.db
        .query("messages")
        .withIndex("by_renter_status", (q) => q.eq("renterId", renterId).eq("status", "sent"))
        .take(MAX_MESSAGES),
      ctx.db
        .query("messages")
        .withIndex("by_renter_status", (q) => q.eq("renterId", renterId).eq("status", "received"))
        .take(MAX_MESSAGES),
      ctx.db
        .query("messages")
        .withIndex("by_renter_status", (q) => q.eq("renterId", renterId).eq("status", "draft"))
        .take(MAX_THREADS),
      ctx.db
        .query("tours")
        .withIndex("by_renter", (q) => q.eq("renterId", renterId))
        .order("desc")
        .take(MAX_TOURS),
    ]);

    const over = new Set<Id<"threads">>();
    const demo = new Set<Id<"threads">>();
    let monthlySavings = 0;
    let monthlySavingsDemo = 0;
    let concessionsWon = 0;
    let concessionsWonDemo = 0;
    let questions = 0;
    for (const thread of threads) {
      if (thread.isSimulated) demo.add(thread._id);
      if (OVER.has(thread.stage)) {
        over.add(thread._id);
        continue;
      }
      if (thread.rentAsked !== undefined && thread.rentBestOffer !== undefined) {
        const saved = Math.max(0, thread.rentAsked - thread.rentBestOffer);
        monthlySavings += saved;
        if (thread.isSimulated) monthlySavingsDemo += saved;
      }
      concessionsWon += thread.concessionsWon.length;
      if (thread.isSimulated) concessionsWonDemo += thread.concessionsWon.length;
      if (thread.openQuestions.length > 0) questions += 1;
    }

    const contacted = new Set<Id<"threads">>();
    for (const message of sent) {
      if (message.direction === "outbound") contacted.add(message.threadId);
    }

    const pendingDrafts = drafts.filter((m) => !over.has(m.threadId)).length;
    const proposedTours = tours.filter((t) => t.status === "proposed" && !over.has(t.threadId)).length;
    const booked = tours.filter((t) => t.status === "confirmed" || t.status === "completed");
    const toursBooked = booked.length;
    const toursBookedDemo = booked.filter((t) => demo.has(t.threadId)).length;

    return {
      listings: listings.length,
      inquiriesSent: contacted.size,
      replies: received.length,
      toursBooked,
      monthlySavings: Math.round(monthlySavings),
      toursBookedDemo,
      monthlySavingsDemo: Math.round(monthlySavingsDemo),
      concessionsWon,
      concessionsWonDemo,
      needsYou: pendingDrafts + questions + proposedTours,
      needsYouBreakdown: { drafts: pendingDrafts, questions, tours: proposedTours },
    };
  },
});
