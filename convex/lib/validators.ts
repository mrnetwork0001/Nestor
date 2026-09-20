import { v, type Infer } from "convex/values";

/**
 * Shared validators. The schema and every function reuse these so the
 * renter-facing enums stay in one place.
 */

// Renter profile -------------------------------------------------------------

// Bands, never raw numbers: the Passport is a public page.
export const creditBand = v.union(
  v.literal("excellent"), // 740+
  v.literal("good"), // 670-739
  v.literal("fair"), // 580-669
  v.literal("building"), // below 580 or no history yet
);

export const incomeBand = v.union(
  v.literal("under_3k"),
  v.literal("3k_5k"),
  v.literal("5k_8k"),
  v.literal("8k_12k"),
  v.literal("12k_plus"),
);

export const negotiationGoal = v.union(
  v.literal("lower_rent"),
  v.literal("waive_pet_fee"),
  v.literal("waive_application_fee"),
  v.literal("reduced_deposit"),
  v.literal("flexible_move_in"),
  v.literal("shorter_lease"),
  v.literal("longer_lease_discount"),
  v.literal("free_parking"),
);

export const pets = v.object({
  hasPets: v.boolean(),
  description: v.optional(v.string()), // "One 30lb beagle, house-trained"
});

// Listings -------------------------------------------------------------------

export const listingStatus = v.union(
  v.literal("queued"),
  v.literal("scouting"),
  v.literal("ready"),
  v.literal("failed"),
);

// Where a landlord email came from. Never inferred or guessed.
export const contactSource = v.union(
  v.literal("listing"), // published on the listing page itself
  v.literal("scout_search"), // found by the Scout on the property's own site
  v.literal("renter"), // typed in by the renter
  v.literal("sample"), // bundled demo listing
);

export const contactSearchStatus = v.union(
  v.literal("searching"),
  v.literal("done"),
  v.literal("failed"),
);

export const contactCandidate = v.object({
  email: v.string(),
  sourceUrl: v.string(), // the page the address was published on
  label: v.optional(v.string()), // "Leasing office", "Property manager"
});

export const mailboxRole = v.union(
  v.literal("agent"),
  v.literal("landlord_sim"),
);

export const listingFee = v.object({
  label: v.string(),
  amount: v.optional(v.number()),
  cadence: v.optional(
    v.union(v.literal("one_time"), v.literal("monthly"), v.literal("unknown")),
  ),
});

// Conversations --------------------------------------------------------------

export const threadStage = v.union(
  v.literal("drafting"), // Negotiator is writing
  v.literal("needs_approval"), // draft waiting on the renter
  v.literal("awaiting_reply"), // sent, nothing back yet
  v.literal("negotiating"), // landlord replied, back and forth
  v.literal("tour_scheduled"),
  v.literal("terms_agreed"),
  v.literal("declined"),
  v.literal("closed"),
);

export const messageDirection = v.union(
  v.literal("outbound"),
  v.literal("inbound"),
);

export const messageStatus = v.union(
  v.literal("draft"),
  v.literal("queued"),
  v.literal("sent"),
  v.literal("received"),
  v.literal("failed"),
  v.literal("discarded"),
);

// "agentmail" went over real email. "simulated" never left Convex.
export const messageChannel = v.union(
  v.literal("agentmail"),
  v.literal("simulated"),
);

export const replyIntent = v.union(
  v.literal("tour_offer"),
  v.literal("counter_offer"),
  v.literal("acceptance"),
  v.literal("question"),
  v.literal("rejection"),
  v.literal("other"),
);

export const tourSlot = v.object({
  startsAt: v.number(), // ms since epoch
  label: v.string(), // the landlord's own words, e.g. "Saturday at 2pm"
});

/** What the Negotiator understood from one inbound landlord email. */
export const replyAnalysis = v.object({
  intent: replyIntent,
  summary: v.string(),
  sentiment: v.union(
    v.literal("positive"),
    v.literal("neutral"),
    v.literal("negative"),
  ),
  tourSlots: v.array(tourSlot),
  rentOffered: v.optional(v.number()),
  concessions: v.array(v.string()),
  questionsForRenter: v.array(v.string()),
  // Who actually read this email, recorded where the reading happens. Optional:
  // rows saved before provenance was tracked have neither, and the UI makes no claim for them.
  source: v.optional(v.union(v.literal("openai"), v.literal("rules"))),
  model: v.optional(v.string()), // the OpenAI model id that answered; only with source "openai"
});

/** Where a draft's words came from: OpenAI (and which model) or the built-in template. */
export const draftSource = v.object({
  kind: v.union(v.literal("openai"), v.literal("template")),
  model: v.optional(v.string()), // only with kind "openai"
});

export const tourStatus = v.union(
  v.literal("proposed"), // landlord offered, renter has not chosen
  v.literal("confirmed"),
  v.literal("declined"),
  v.literal("completed"),
);

// Lease audit ----------------------------------------------------------------

export const auditStatus = v.union(
  v.literal("uploaded"),
  v.literal("analyzing"),
  v.literal("done"),
  v.literal("failed"),
);

export const riskLevel = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const leaseFlag = v.object({
  severity: riskLevel,
  category: v.string(), // "Fees", "Entry & privacy", "Deposit", ...
  title: v.string(),
  clauseQuote: v.string(),
  pageHint: v.optional(v.string()),
  whyItMatters: v.string(),
  suggestedAsk: v.string(),
});

// Activity feed --------------------------------------------------------------

export const activityKind = v.union(
  v.literal("scout"),
  v.literal("negotiator"),
  v.literal("landlord"),
  v.literal("tour"),
  v.literal("lease"),
  v.literal("system"),
);

export type CreditBand = Infer<typeof creditBand>;
export type IncomeBand = Infer<typeof incomeBand>;
export type NegotiationGoal = Infer<typeof negotiationGoal>;
export type ListingStatus = Infer<typeof listingStatus>;
export type ThreadStage = Infer<typeof threadStage>;
export type ReplyAnalysis = Infer<typeof replyAnalysis>;
export type DraftSource = Infer<typeof draftSource>;
export type TourSlot = Infer<typeof tourSlot>;
export type LeaseFlag = Infer<typeof leaseFlag>;
export type RiskLevel = Infer<typeof riskLevel>;
export type ActivityKind = Infer<typeof activityKind>;
