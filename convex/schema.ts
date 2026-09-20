import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  activityKind,
  auditStatus,
  contactCandidate,
  contactSearchStatus,
  contactSource,
  creditBand,
  incomeBand,
  leaseFlag,
  listingFee,
  listingStatus,
  mailboxRole,
  messageChannel,
  messageDirection,
  messageStatus,
  negotiationGoal,
  pets,
  replyAnalysis,
  riskLevel,
  threadStage,
  tourStatus,
} from "./lib/validators";

export default defineSchema({
  ...authTables,

  // One per signed-in user: search preferences, the Passport, and the agent's inbox.
  renters: defineTable({
    userId: v.id("users"),
    isGuest: v.boolean(), // guests may only talk to simulated landlords

    // Identity shown to landlords
    displayName: v.string(),
    headline: v.optional(v.string()), // "Product designer, relocating for work"
    bio: v.optional(v.string()),
    occupation: v.optional(v.string()),

    // Search
    city: v.string(),
    neighborhoods: v.array(v.string()),
    budgetMin: v.optional(v.number()),
    budgetMax: v.number(),
    bedroomsMin: v.number(),
    moveInDate: v.optional(v.string()), // YYYY-MM-DD
    leaseTermMonths: v.optional(v.number()),
    mustHaves: v.array(v.string()),

    // Passport facts. Bands only, because the Passport page is public.
    creditBand,
    incomeBand,
    pets,
    occupants: v.number(),
    smoker: v.boolean(),
    hasRentalHistory: v.boolean(),
    passportToken: v.string(), // unguessable, used in /passport/:token
    passportViews: v.number(),

    // Negotiation policy
    negotiationGoals: v.array(negotiationGoal),
    autopilot: v.boolean(), // false = every outbound email waits for approval
  })
    .index("by_user", ["userId"])
    .index("by_passport_token", ["passportToken"]),

  // Nestor's AgentMail inboxes. The free tier allows three, so every renter
  // shares one agent inbox and conversations are told apart by thread id.
  // "landlord_sim" is the demo landlord: a real mailbox Nestor also operates.
  mailboxes: defineTable({
    role: mailboxRole,
    inboxId: v.string(), // AgentMail inbox_id, which is the email address
    email: v.string(),
    displayName: v.string(),
    lastPolledAt: v.optional(v.number()),
  })
    .index("by_role", ["role"])
    .index("by_inbox", ["inboxId"]),

  listings: defineTable({
    renterId: v.id("renters"),
    sourceUrl: v.string(),
    status: listingStatus,
    isSample: v.boolean(), // bundled demo listing, not scraped
    error: v.optional(v.string()),
    scrapedAt: v.optional(v.number()),

    title: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    neighborhood: v.optional(v.string()),
    rentMonthly: v.optional(v.number()),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    sqft: v.optional(v.number()),
    availableDate: v.optional(v.string()),
    leaseTermMonths: v.optional(v.number()),
    deposit: v.optional(v.number()),
    petPolicy: v.optional(v.string()),
    fees: v.array(listingFee),
    amenities: v.array(v.string()),
    photos: v.array(v.string()),
    description: v.optional(v.string()),

    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    // Rental portals rarely publish an email, so the Scout can look for the
    // leasing office's own site. Candidates are only ever addresses found
    // published on a page, never guessed, and the renter picks one.
    contactEmailSource: v.optional(contactSource),
    contactSearch: v.optional(contactSearchStatus),
    contactCandidates: v.array(contactCandidate),

    // How well it fits this renter, computed when the scrape lands
    matchScore: v.optional(v.number()), // 0-100
    matchReasons: v.array(v.string()),
    concerns: v.array(v.string()),

    archived: v.boolean(),
  })
    .index("by_renter", ["renterId", "archived"])
    .index("by_renter_url", ["renterId", "sourceUrl"])
    .index("by_status", ["status"]),

  // One email conversation between the Negotiator and one landlord.
  threads: defineTable({
    renterId: v.id("renters"),
    listingId: v.id("listings"),
    stage: threadStage,
    isSimulated: v.boolean(), // the landlord is Nestor's demo persona
    landlordName: v.optional(v.string()),
    landlordEmail: v.string(),
    subject: v.string(),
    agentmailThreadId: v.optional(v.string()),

    // Rolling negotiation state, rebuilt from each inbound analysis
    rentAsked: v.optional(v.number()),
    rentBestOffer: v.optional(v.number()),
    concessionsWon: v.array(v.string()),
    openQuestions: v.array(v.string()), // things only the renter can answer
    renterNotes: v.array(v.string()), // instructions the renter gave the agent

    lastMessageAt: v.number(),
    lastInboundAt: v.optional(v.number()),
    unread: v.boolean(),
  })
    .index("by_renter", ["renterId", "lastMessageAt"])
    .index("by_listing", ["listingId"])
    .index("by_agentmail_thread", ["agentmailThreadId"])
    .index("by_renter_stage", ["renterId", "stage"]),

  messages: defineTable({
    threadId: v.id("threads"),
    renterId: v.id("renters"),
    direction: messageDirection,
    status: messageStatus,
    channel: messageChannel,
    fromAddress: v.string(),
    toAddress: v.string(),
    subject: v.string(),
    body: v.string(),
    agentmailMessageId: v.optional(v.string()),
    // Why the Negotiator wrote what it wrote, shown beside drafts
    rationale: v.optional(v.string()),
    // Inbound only
    analysis: v.optional(replyAnalysis),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  })
    .index("by_thread", ["threadId"])
    .index("by_agentmail_message", ["agentmailMessageId"])
    .index("by_renter_status", ["renterId", "status"]),

  tours: defineTable({
    renterId: v.id("renters"),
    listingId: v.id("listings"),
    threadId: v.id("threads"),
    startsAt: v.number(),
    label: v.string(),
    status: tourStatus,
    notes: v.optional(v.string()),
  })
    .index("by_renter", ["renterId", "startsAt"])
    .index("by_thread", ["threadId"]),

  leaseAudits: defineTable({
    renterId: v.id("renters"),
    listingId: v.optional(v.id("listings")),
    storageId: v.optional(v.id("_storage")), // absent for the bundled sample lease
    fileName: v.string(),
    isSample: v.boolean(),
    status: auditStatus,
    overallRisk: v.optional(riskLevel),
    summary: v.optional(v.string()),
    flags: v.array(leaseFlag),
    model: v.optional(v.string()),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_renter", ["renterId"])
    // Lets the orphan sweep ask "does any audit use this upload?"
    .index("by_storage", ["storageId"]),

  // Append-only feed of what the agents did. Drives the live dashboard.
  activity: defineTable({
    renterId: v.id("renters"),
    kind: activityKind,
    title: v.string(),
    detail: v.optional(v.string()),
    listingId: v.optional(v.id("listings")),
    threadId: v.optional(v.id("threads")),
  }).index("by_renter", ["renterId"]),
});
