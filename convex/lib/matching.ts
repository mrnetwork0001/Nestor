import type { Doc } from "../_generated/dataModel";

/*
 * How well a listing fits a renter. Pure: no database, no clock, so it can run
 * in queries, mutations and actions alike.
 *
 * `concerns` doubles as the Negotiator's leverage, so those sentences may end
 * up paraphrased in an email to a landlord. They never state the renter's
 * budget or how far over it a rent is. `matchReasons` are only ever shown to
 * the renter.
 */

export type MatchRenter = Pick<
  Doc<"renters">,
  "budgetMax" | "bedroomsMin" | "pets" | "mustHaves" | "neighborhoods"
> &
  Partial<Pick<Doc<"renters">, "moveInDate" | "leaseTermMonths">>;

export type MatchListing = Partial<
  Pick<
    Doc<"listings">,
    | "title"
    | "rentMonthly"
    | "bedrooms"
    | "petPolicy"
    | "availableDate"
    | "amenities"
    | "description"
    | "fees"
    | "deposit"
    | "neighborhood"
    | "address"
    | "leaseTermMonths"
  >
>;

export type MatchResult = { matchScore: number; matchReasons: string[]; concerns: string[] };

type Factor = { earned: number; possible: number };

const usd = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;
const bedLabel = (n: number): string => (n === 0 ? "studio" : `${n}-bed`);
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// A must-have typed by a renter rarely matches a portal's amenity wording, so
// both sides are mapped onto the same idea before comparing.
const AMENITY_IDEAS: Array<{ ask: RegExp; offer: RegExp }> = [
  {
    ask: /in (unit|home|suite) (laundry|washer|w d)|(laundry|washer|w d).* in (unit|home|suite)/,
    offer: /in (unit|home|suite) (laundry|washer|w d)|(laundry|washer|dryer|w d)( and dryer| dryer)? in (unit|home|suite)|washer (and )?dryer(?! hookup)/,
  },
  { ask: /laundry|washer|dryer/, offer: /laundry|washer|dryer/ },
  { ask: /parking|garage|carport/, offer: /parking|garage|carport/ },
  { ask: /\b(a c|ac|air con|air conditioning|central air|cooling)\b/, offer: /\b(a c|ac)\b|air condition|central air/ },
  { ask: /dishwasher/, offer: /dishwasher/ },
  { ask: /gym|fitness/, offer: /gym|fitness/ },
  { ask: /pool/, offer: /pool/ },
  { ask: /balcony|patio|terrace|deck|outdoor/, offer: /balcony|patio|terrace|deck|rooftop|courtyard/ },
  { ask: /yard|garden/, offer: /yard|garden/ },
  { ask: /elevator|lift/, offer: /elevator/ },
  { ask: /doorman|concierge/, offer: /doorman|concierge|front desk/ },
  { ask: /furnished/, offer: /\bfurnished/ },
  { ask: /hardwood|wood floor/, offer: /hardwood|wood floor|plank/ },
  { ask: /storage/, offer: /storage/ },
  { ask: /bike/, offer: /bike|bicycle/ },
  { ask: /\b(transit|subway|metro|train|rail|bus)\b/, offer: /\b(transit|subway|metro|train|rail|bus)\b/ },
  { ask: /utilities/, offer: /utilities (are )?included|all utilities/ },
  { ask: /wifi|internet/, offer: /wifi|wi fi|internet/ },
  { ask: /ev charg|electric vehicle/, offer: /ev charg|electric vehicle|car charging/ },
  { ask: /accessible|wheelchair/, offer: /accessible|wheelchair/ },
  { ask: /light|sunny|bright/, offer: /natural light|sunny|bright|large windows|floor to ceiling/ },
];

const STOPWORDS = new Set(["the", "and", "with", "for", "near", "close", "good", "nice", "has", "have"]);

type PetStance = "allowed" | "restricted" | "none" | "unknown";

function petStance(policy: string | undefined, haystack: string): PetStance {
  const p = norm(policy ?? "");
  if (/\bno (pets|dogs or cats|animals)|pets? (are )?not (allowed|permitted)|pet free/.test(p)) return "none";
  if (/\bno (breed|weight|size) (restrictions?|limits?)/.test(p)) return "allowed";
  if (/cats? only|dogs? only|no dogs|no cats|small (dogs|pets)|case by case|breed|weight|restrict|under \d+|lbs?/.test(p)) {
    return "restricted";
  }
  if (/pet|dog|cat/.test(p)) return "allowed";
  if (/pet friendly|pets (allowed|welcome|ok)|dog park|dogs? (allowed|welcome|ok)|cats? (allowed|welcome|ok)/.test(haystack)) {
    return "allowed";
  }
  return "unknown";
}

const DOG_WORDS = /\b(dogs?|pupp(y|ies)|beagle|retriever|terrier|shepherd|poodle|labrador|lab|bulldog|husky|corgi|spaniel|pit ?bull|doodle|hound|chihuahua|dachshund|collie|mutt)\b/;
const CAT_WORDS = /\b(cats?|kittens?|tabby)\b/;

/** The species the policy shuts out that this renter actually has, if any. */
function excludedPet(policy: string | undefined, petDescription: string | undefined): "dog" | "cat" | null {
  const p = norm(policy ?? "");
  const mine = norm(petDescription ?? "");
  if (/cats? only|no dogs/.test(p) && DOG_WORDS.test(mine)) return "dog";
  if (/dogs? only|no cats/.test(p) && CAT_WORDS.test(mine)) return "cat";
  return null;
}

function isPetAsk(mustHave: string): boolean {
  return /\b(pet|pets|dog|dogs|cat|cats)\b/.test(mustHave);
}

function offers(mustHave: string, haystack: string): boolean {
  const idea = AMENITY_IDEAS.find(({ ask }) => ask.test(mustHave));
  if (idea) return idea.offer.test(haystack);
  const words = mustHave.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return words.length > 0 && words.every((w) => haystack.includes(w));
}

export function scoreListing(renter: MatchRenter, listing: MatchListing): MatchResult {
  const reasons: string[] = [];
  const concerns: string[] = [];
  const factors: Factor[] = [];

  const amenities = listing.amenities ?? [];
  const fees = listing.fees ?? [];
  const haystack = norm([listing.title, listing.description, listing.petPolicy, ...amenities].filter(Boolean).join(" . "));

  // Budget
  const rent = listing.rentMonthly;
  if (rent === undefined) {
    factors.push({ earned: 14, possible: 35 });
    concerns.push("The rent is not listed, so Nestor will ask for it.");
  } else if (rent <= renter.budgetMax) {
    factors.push({ earned: 35, possible: 35 });
    const under = renter.budgetMax - rent;
    reasons.push(under >= 25 ? `${usd(rent)}/mo is ${usd(under)} under your budget.` : `${usd(rent)}/mo is right at your budget.`);
  } else {
    const over = (rent - renter.budgetMax) / renter.budgetMax;
    factors.push({ earned: Math.round(35 * Math.max(0, 1 - over / 0.2) * 0.8), possible: 35 });
    // No figures here: this sentence can reach a landlord.
    concerns.push(over <= 0.1 ? "The asking rent is a little above your budget, so the rent is worth negotiating." : "The asking rent is well above your budget.");
  }

  // Bedrooms
  const beds = listing.bedrooms;
  if (beds === undefined) {
    factors.push({ earned: 10, possible: 20 });
    concerns.push("The bedroom count is not stated; the building may have several floor plans.");
  } else if (beds >= renter.bedroomsMin) {
    factors.push({ earned: 20, possible: 20 });
    reasons.push(beds > renter.bedroomsMin ? `A ${bedLabel(beds)}: more room than the ${bedLabel(renter.bedroomsMin)} you need.` : `A ${bedLabel(beds)}, as you asked.`);
  } else {
    factors.push({ earned: beds === renter.bedroomsMin - 1 ? 5 : 0, possible: 20 });
    concerns.push(`It is a ${bedLabel(beds)}, smaller than the ${bedLabel(renter.bedroomsMin)} you are looking for.`);
  }

  // Pets. Only counts for renters who have one.
  const excluded = renter.pets.hasPets ? excludedPet(listing.petPolicy, renter.pets.description) : null;
  const stance = excluded !== null ? "none" : petStance(listing.petPolicy, haystack);
  if (renter.pets.hasPets) {
    if (excluded !== null) {
      factors.push({ earned: 0, possible: 15 });
      concerns.push(`The pet policy (${listing.petPolicy}) rules out your ${excluded}.`);
    } else if (stance === "allowed") {
      factors.push({ earned: 15, possible: 15 });
      reasons.push("Pets are welcome.");
    } else if (stance === "restricted") {
      factors.push({ earned: 9, possible: 15 });
      concerns.push(`Pets are allowed with limits (${listing.petPolicy}), so confirm yours qualifies.`);
    } else if (stance === "none") {
      factors.push({ earned: 0, possible: 15 });
      concerns.push("The listing says no pets.");
    } else {
      factors.push({ earned: 7, possible: 15 });
      concerns.push("The pet policy is not stated; Nestor will ask before anything else.");
    }
  }

  // Move-in date vs availability
  const available = listing.availableDate;
  const wanted = renter.moveInDate;
  if (available === "now") {
    factors.push({ earned: 10, possible: 10 });
    reasons.push("Available now.");
  } else if (available !== undefined && wanted !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(available)) {
    const gapDays = Math.round((Date.parse(`${available}T00:00:00Z`) - Date.parse(`${wanted}T00:00:00Z`)) / 86_400_000);
    if (Number.isNaN(gapDays)) {
      factors.push({ earned: 6, possible: 10 });
    } else if (gapDays <= 0) {
      factors.push({ earned: 10, possible: 10 });
      reasons.push("Ready before your move-in date.");
    } else if (gapDays <= 14) {
      factors.push({ earned: 6, possible: 10 });
      concerns.push(`It opens up ${gapDays} day${gapDays === 1 ? "" : "s"} after your move-in date.`);
    } else {
      factors.push({ earned: 1, possible: 10 });
      concerns.push(`It is not available until ${available}, well after your move-in date.`);
    }
  } else if (wanted !== undefined) {
    factors.push({ earned: 6, possible: 10 });
    if (available === undefined) concerns.push("No availability date is listed.");
  }

  // Must-haves
  const asks = renter.mustHaves.map(norm).filter(Boolean);
  if (asks.length > 0) {
    const met: string[] = [];
    const missing: string[] = [];
    renter.mustHaves.forEach((original, i) => {
      const ask = asks[i];
      if (!ask) return;
      const ok = isPetAsk(ask) ? stance === "allowed" || stance === "restricted" : offers(ask, haystack);
      (ok ? met : missing).push(original.trim());
    });
    factors.push({ earned: Math.round((15 * met.length) / asks.length), possible: 15 });
    if (met.length > 0) reasons.push(`Ticks your must-haves: ${met.join(", ")}.`);
    if (missing.length > 0) concerns.push(`Not mentioned: ${missing.join(", ")}.`);
  }

  // Fees. Each one is something the Negotiator can ask to have waived.
  const relevantFees = fees.filter((f) => renter.pets.hasPets || !/\b(pet|dog|cat)\b/i.test(f.label));
  const oneTime = relevantFees.filter((f) => f.cadence !== "monthly" && (f.amount ?? 0) > 0);
  const monthly = relevantFees.filter((f) => f.cadence === "monthly" && (f.amount ?? 0) > 0);
  const oneTimeTotal = oneTime.reduce((sum, f) => sum + (f.amount ?? 0), 0);
  const monthlyTotal = monthly.reduce((sum, f) => sum + (f.amount ?? 0), 0);
  let feeScore = 5;
  if (oneTimeTotal > 0) {
    feeScore -= oneTimeTotal > 300 ? 2 : 1;
    concerns.push(`Up-front fees of ${usd(oneTimeTotal)} (${oneTime.map((f) => `${f.label} ${usd(f.amount ?? 0)}`).join(", ")}).`);
  }
  if (monthlyTotal > 0) {
    feeScore -= monthlyTotal > 100 ? 2 : 1;
    concerns.push(`Monthly fees add ${usd(monthlyTotal)} on top of rent (${monthly.map((f) => `${f.label} ${usd(f.amount ?? 0)}`).join(", ")}).`);
  }
  if (rent !== undefined && listing.deposit !== undefined && listing.deposit > rent * 1.25) {
    feeScore -= 1;
    concerns.push(`The deposit is ${usd(listing.deposit)}, more than a month's rent.`);
  }
  factors.push({ earned: Math.max(0, feeScore), possible: 5 });
  if (fees.length === 0 && rent !== undefined) reasons.push("No extra fees are listed.");

  // Neighborhood is a bonus, never a penalty: portals often leave it out.
  const place = norm([listing.neighborhood, listing.address, listing.title].filter(Boolean).join(" "));
  const hood = renter.neighborhoods.find((n) => norm(n).length > 2 && place.includes(norm(n)));
  if (hood) reasons.push(`In ${hood.trim()}, one of your neighborhoods.`);

  if (
    renter.leaseTermMonths !== undefined &&
    listing.leaseTermMonths !== undefined &&
    listing.leaseTermMonths !== renter.leaseTermMonths
  ) {
    concerns.push(`The listed lease is ${listing.leaseTermMonths} months; you want ${renter.leaseTermMonths}.`);
  }

  const possible = factors.reduce((sum, f) => sum + f.possible, 0);
  const earned = factors.reduce((sum, f) => sum + f.earned, 0);
  const base = possible === 0 ? 0 : (earned / possible) * 100;
  const matchScore = Math.max(0, Math.min(100, Math.round(base + (hood ? 4 : 0))));

  return { matchScore, matchReasons: reasons.slice(0, 6), concerns: concerns.slice(0, 6) };
}
