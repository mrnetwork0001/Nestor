import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

/*
 * The live site is public and lets guests in, so everything that spends
 * credits or sends email is capped. Per-renter limits are keyed by renter id;
 * "global" limits protect the shared quotas. AgentMail's free plan is 3,000
 * emails a month; its public pricing page has also listed 100 a day, so the two
 * global email caps together stay under 100.
 *
 *   await limits.limit(ctx, "scrapeListing", { key: renter._id, throws: true });
 */
const definitions = {
  // Scout (Firecrawl: 5 credits per listing extraction)
  scrapeListing: { kind: "token bucket", rate: 12, period: HOUR, capacity: 6 },
  discoverListings: { kind: "fixed window", rate: 4, period: HOUR },
  findContact: { kind: "fixed window", rate: 8, period: HOUR },

  // Negotiator
  draftEmail: { kind: "token bucket", rate: 40, period: HOUR, capacity: 10 },
  // Real email to an address outside Nestor. Account holders only.
  sendExternalEmail: { kind: "fixed window", rate: 6, period: DAY },
  // Only account holders reach this, so it needs far less room than the demo.
  globalExternalEmail: { kind: "fixed window", rate: 15, period: DAY },
  // Real email between Nestor's own two inboxes (the demo landlord).
  sendSimEmail: { kind: "fixed window", rate: 12, period: DAY },
  // Both directions count, about six per demo conversation. Past this the demo
  // landlord answers inside Convex, labelled as such.
  globalSimEmail: { kind: "fixed window", rate: 80, period: DAY },

  // Lease audit (the most expensive OpenAI call)
  leaseAudit: { kind: "fixed window", rate: 5, period: DAY },

  uploadUrl: { kind: "fixed window", rate: 10, period: DAY },

  // Deployment-wide ceilings, no key. Guests are one click to create, so the per-renter
  // limits above do not bound what the shared Firecrawl and OpenAI keys can be made to spend.
  globalScrape: { kind: "fixed window", rate: 150, period: DAY },
  globalDiscover: { kind: "fixed window", rate: 30, period: DAY },
  globalFindContact: { kind: "fixed window", rate: 40, period: DAY },
  globalLeaseAudit: { kind: "fixed window", rate: 25, period: DAY },
  globalDraft: { kind: "fixed window", rate: 300, period: DAY },
  globalUploadUrl: { kind: "fixed window", rate: 150, period: DAY },
  // Paid readings of landlord mail, keyed by thread, so a mail loop cannot run up the bill.
  inboundAnalysis: { kind: "fixed window", rate: 12, period: DAY },
  // Real emails to one address, from all renters together.
  recipientEmail: { kind: "fixed window", rate: 3, period: DAY },

  // Public, unauthenticated
  passportView: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
} as const;

export const limits = new RateLimiter(components.rateLimiter, definitions);

type LimitName = keyof typeof definitions;

function waitPhrase(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / MINUTE);
  if (minutes <= 1) return "in a minute";
  if (minutes < 90) return `in about ${minutes} minutes`;
  return `in about ${Math.ceil(minutes / 60)} hours`;
}

/**
 * `limits.limit(..., { throws: true })` throws a ConvexError whose data is an
 * object, which the client would show as "[object Object]". This throws a
 * plain sentence instead: `what` finishes "You have reached the limit for ...".
 */
export async function limitOrThrow(
  ctx: MutationCtx,
  name: LimitName,
  key: string,
  what: string,
  globalName?: LimitName,
): Promise<void> {
  const status = await limits.limit(ctx, name, { key });
  if (!status.ok) {
    throw new ConvexError(`You have reached the limit for ${what}. Try again ${waitPhrase(status.retryAfter)}.`);
  }
  if (globalName === undefined) return;
  // The throw rolls the mutation back, so the renter's own token is not lost.
  const shared = await limits.limit(ctx, globalName);
  if (!shared.ok) {
    throw new ConvexError(`Nestor has used today's shared allowance for ${what}. Please try again tomorrow.`);
  }
}
