/*
 * One fictional renter and one fictional listing carry every product fragment
 * on the landing page, so the page reads as a single story. The landlord and
 * the building come from Nestor's bundled sample listings; nothing here is a
 * real person, address or result, and the page says so in its captions.
 */

export const STORY = {
  renter: { name: "Maya Okafor", first: "Maya" },
  landlord: { name: "Dana Whitfield", first: "Dana", initials: "DW" },
  listing: {
    title: "Sunny 1-bed at Maple Court",
    address: "1420 Maple Court, Unit 3B",
    place: "Logan Square, Chicago",
    facts: "1 bd · 1 ba · 770 sqft",
    rentAsked: 1950,
    rentAgreed: 1900,
    deposit: 1950,
    matchScore: 92,
    photo:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=640&q=70",
    fees: [
      { label: "Application fee", amount: "$75", cadence: "one time" },
      { label: "Pet fee", amount: "$350", cadence: "one time" },
      { label: "Pet rent", amount: "$35", cadence: "monthly" },
    ],
  },
  tours: ["Sat, Sep 26 · 11:00 AM", "Tue, Sep 29 · 5:30 PM"],
} as const;

export type FeedKind = "scout" | "negotiator" | "landlord" | "tour" | "lease" | "system";

/** Oldest first. The hero feed plays these in order and loops. */
export const STORY_FEED: ReadonlyArray<{ kind: FeedKind; title: string }> = [
  { kind: "scout", title: "Found a 1-bed in Logan Square for $1,950" },
  { kind: "scout", title: "Maple Court scores 92: under budget, dogs welcome" },
  { kind: "negotiator", title: "Drafted an inquiry to Dana Whitfield" },
  { kind: "system", title: "Maya approved the email. Sent from Nestor's inbox" },
  { kind: "landlord", title: "Dana offered Saturday 11:00 AM or Tuesday 5:30 PM" },
  { kind: "landlord", title: "Dana took $50 off the rent and waived the pet fee" },
  { kind: "tour", title: "Tour booked for Saturday at 11:00 AM" },
  { kind: "lease", title: "Lease check found 3 clauses worth asking about" },
];

/** One flag from the review of Nestor's bundled sample lease, word for word. */
export const SAMPLE_FLAG = {
  category: "Entry & privacy",
  section: "Section 9",
  title: "Landlord can enter without notice",
  clause:
    "Landlord or its agents may enter the Premises at any time, without prior notice, for inspection, repairs, or to show the Premises to prospective residents or buyers.",
  why: "Many states require reasonable advance notice, often 24 hours, except in an emergency. As written, someone could walk into your home at any hour for a routine showing.",
  ask: "Could Section 9 require at least 24 hours' written notice and entry during normal daytime hours, except for genuine emergencies?",
} as const;
