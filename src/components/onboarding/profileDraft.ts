import type { FunctionArgs } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { PassportFacts } from "@/components/passport/passportFacts";

/*
 * The renter profile as a form. Onboarding and the Passport editor share this
 * draft shape, its validation and its conversion to `api.renters.save` args,
 * so the two screens cannot drift apart. The limits mirror convex/renters.ts.
 */

type Renter = Doc<"renters">;
export type CreditBand = Renter["creditBand"];
export type IncomeBand = Renter["incomeBand"];
export type NegotiationGoal = Renter["negotiationGoals"][number];
export type SaveArgs = FunctionArgs<typeof api.renters.save>;

export const LIMITS = {
  name: 80,
  city: 80,
  headline: 120,
  occupation: 80,
  bio: 600,
  petDescription: 120,
  listItems: 12,
  listItemChars: 60,
} as const;

/** Money fields stay strings while typing so "1,9" or "" never turns into NaN in state. */
export interface ProfileDraft {
  displayName: string;
  headline: string;
  occupation: string;
  bio: string;

  city: string;
  neighborhoods: string[];
  budgetMin: string;
  budgetMax: string;
  bedroomsMin: number;
  moveInDate: string;
  leaseTermMonths: string;
  mustHaves: string[];

  occupants: number;
  hasPets: boolean;
  petDescription: string;
  smoker: boolean;
  hasRentalHistory: boolean;
  creditBand: CreditBand;
  incomeBand: IncomeBand;

  negotiationGoals: NegotiationGoal[];
}

export type DraftErrors = Partial<Record<keyof ProfileDraft, string>>;
export type DraftChange = (patch: Partial<ProfileDraft>) => void;

export const CREDIT_BANDS: CreditBand[] = ["excellent", "good", "fair", "building"];
export const INCOME_BANDS: IncomeBand[] = ["under_3k", "3k_5k", "5k_8k", "8k_12k", "12k_plus"];
export const LEASE_TERMS = [6, 9, 12, 15, 18, 24];

// Wording chosen to line up with the amenity ideas the Scout's matcher knows.
export const MUST_HAVE_OPTIONS = [
  "In-unit laundry",
  "Dishwasher",
  "Air conditioning",
  "Parking",
  "Balcony or patio",
  "Elevator",
  "Gym",
  "Near transit",
  "Hardwood floors",
  "Bike storage",
];

export const GOAL_OPTIONS: ReadonlyArray<{ goal: NegotiationGoal; hint: string }> = [
  { goal: "lower_rent", hint: "Ask whether the monthly rent has any room" },
  { goal: "waive_application_fee", hint: "Ask to drop the application or admin fee" },
  { goal: "waive_pet_fee", hint: "Ask to drop a one-time pet fee or deposit" },
  { goal: "reduced_deposit", hint: "Ask for a smaller security deposit" },
  { goal: "flexible_move_in", hint: "Ask to shift the start date without paying for empty weeks" },
  { goal: "longer_lease_discount", hint: "Offer a longer lease in exchange for a lower rate" },
  { goal: "shorter_lease", hint: "Ask for a shorter term at the same rate" },
  { goal: "free_parking", hint: "Ask to include a parking spot" },
];

function isoDaysFromNow(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayIso(): string {
  return isoDaysFromNow(0);
}

/** Sensible starting answers, so a guest can reach the dashboard in under a minute. */
export function emptyDraft(): ProfileDraft {
  return {
    displayName: "",
    headline: "",
    occupation: "",
    bio: "",
    city: "",
    neighborhoods: [],
    budgetMin: "",
    budgetMax: "2000",
    bedroomsMin: 1,
    moveInDate: isoDaysFromNow(30),
    leaseTermMonths: "12",
    mustHaves: [],
    occupants: 1,
    hasPets: false,
    petDescription: "",
    smoker: false,
    hasRentalHistory: true,
    creditBand: "good",
    incomeBand: "5k_8k",
    negotiationGoals: ["lower_rent", "waive_application_fee"],
  };
}

export function draftFromRenter(renter: Renter): ProfileDraft {
  return {
    displayName: renter.displayName,
    headline: renter.headline ?? "",
    occupation: renter.occupation ?? "",
    bio: renter.bio ?? "",
    city: renter.city,
    neighborhoods: [...renter.neighborhoods],
    budgetMin: renter.budgetMin === undefined ? "" : String(renter.budgetMin),
    budgetMax: String(renter.budgetMax),
    bedroomsMin: renter.bedroomsMin,
    moveInDate: renter.moveInDate ?? "",
    leaseTermMonths: renter.leaseTermMonths === undefined ? "" : String(renter.leaseTermMonths),
    mustHaves: [...renter.mustHaves],
    occupants: renter.occupants,
    hasPets: renter.pets.hasPets,
    petDescription: renter.pets.description ?? "",
    smoker: renter.smoker,
    hasRentalHistory: renter.hasRentalHistory,
    creditBand: renter.creditBand,
    incomeBand: renter.incomeBand,
    negotiationGoals: [...renter.negotiationGoals],
  };
}

/** "$1,950" and "1950.00" both mean 1950. Blank or junk is null. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned));
}

function petsFromDraft(draft: ProfileDraft): { hasPets: boolean; description?: string } {
  if (!draft.hasPets) return { hasPets: false };
  const description = draft.petDescription.trim();
  return description ? { hasPets: true, description } : { hasPets: true };
}

export type DraftStep = 1 | 2 | 3;

const STEP_FIELDS: Record<DraftStep, ReadonlyArray<keyof ProfileDraft>> = {
  1: ["displayName", "city", "neighborhoods", "budgetMin", "budgetMax", "moveInDate", "mustHaves"],
  2: ["headline", "occupation", "bio", "petDescription"],
  3: [],
};

export function validateDraft(draft: ProfileDraft): DraftErrors {
  const errors: DraftErrors = {};

  const name = draft.displayName.trim();
  if (name.length === 0) errors.displayName = "Tell Nestor what to call you.";
  else if (name.length > LIMITS.name) errors.displayName = `Keep your name under ${LIMITS.name} characters.`;

  const city = draft.city.trim();
  if (city.length === 0) errors.city = "Which city are you looking in?";
  else if (city.length > LIMITS.city) errors.city = `Keep the city under ${LIMITS.city} characters.`;

  const budgetMax = parseMoney(draft.budgetMax);
  if (budgetMax === null || budgetMax <= 0) {
    errors.budgetMax = "Enter the most you can pay each month, in dollars.";
  } else if (budgetMax > 100_000) {
    errors.budgetMax = "That looks too high. Enter a monthly amount.";
  }

  if (draft.budgetMin.trim() !== "") {
    const budgetMin = parseMoney(draft.budgetMin);
    if (budgetMin === null) errors.budgetMin = "Enter a dollar amount, or leave this blank.";
    else if (budgetMax !== null && budgetMin > budgetMax) {
      errors.budgetMin = "Your minimum cannot be higher than your maximum.";
    }
  }

  if (draft.moveInDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(draft.moveInDate)) {
    errors.moveInDate = "Pick a date, or clear the field if you are flexible.";
  }

  if (draft.neighborhoods.length > LIMITS.listItems) {
    errors.neighborhoods = `Keep it to ${LIMITS.listItems} neighborhoods.`;
  }
  if (draft.mustHaves.length > LIMITS.listItems) {
    errors.mustHaves = `Keep it to ${LIMITS.listItems} must-haves.`;
  }

  if (draft.headline.trim().length > LIMITS.headline) {
    errors.headline = `Keep the headline under ${LIMITS.headline} characters.`;
  }
  if (draft.occupation.trim().length > LIMITS.occupation) {
    errors.occupation = `Keep this under ${LIMITS.occupation} characters.`;
  }
  if (draft.bio.trim().length > LIMITS.bio) {
    errors.bio = `Keep your note under ${LIMITS.bio} characters.`;
  }
  if (draft.hasPets && draft.petDescription.trim().length > LIMITS.petDescription) {
    errors.petDescription = `Keep this under ${LIMITS.petDescription} characters.`;
  }

  return errors;
}

export function errorsForStep(errors: DraftErrors, step: DraftStep): DraftErrors {
  const out: DraftErrors = {};
  for (const field of STEP_FIELDS[step]) {
    if (errors[field]) out[field] = errors[field];
  }
  return out;
}

/** The first step that still has a problem, so "Finish" can take the renter back to it. */
export function firstStepWithErrors(errors: DraftErrors): DraftStep | null {
  for (const step of [1, 2, 3] as const) {
    if (Object.keys(errorsForStep(errors, step)).length > 0) return step;
  }
  return null;
}

/**
 * Only call with a draft that passed `validateDraft`. Optional fields are sent
 * as null when blank: the form shows every field, so blank means "clear it".
 */
export function toSaveArgs(draft: ProfileDraft): SaveArgs {
  const leaseTerm = draft.leaseTermMonths === "" ? null : Number(draft.leaseTermMonths);
  return {
    displayName: draft.displayName.trim(),
    headline: draft.headline.trim() || null,
    occupation: draft.occupation.trim() || null,
    bio: draft.bio.trim() || null,
    city: draft.city.trim(),
    neighborhoods: draft.neighborhoods,
    budgetMin: parseMoney(draft.budgetMin),
    budgetMax: parseMoney(draft.budgetMax) ?? 0,
    bedroomsMin: draft.bedroomsMin,
    moveInDate: draft.moveInDate || null,
    leaseTermMonths: leaseTerm !== null && Number.isInteger(leaseTerm) ? leaseTerm : null,
    mustHaves: draft.mustHaves,
    creditBand: draft.creditBand,
    incomeBand: draft.incomeBand,
    pets: petsFromDraft(draft),
    occupants: draft.occupants,
    smoker: draft.smoker,
    hasRentalHistory: draft.hasRentalHistory,
    negotiationGoals: draft.negotiationGoals,
  };
}

/** The public facts a landlord would see for this draft. Budget and goals never appear here. */
export function passportFromDraft(draft: ProfileDraft, memberSince: number): PassportFacts {
  const leaseTerm = draft.leaseTermMonths === "" ? undefined : Number(draft.leaseTermMonths);
  return {
    displayName: draft.displayName,
    headline: draft.headline.trim() || undefined,
    bio: draft.bio.trim() || undefined,
    occupation: draft.occupation.trim() || undefined,
    city: draft.city,
    moveInDate: draft.moveInDate || undefined,
    leaseTermMonths: leaseTerm,
    bedroomsMin: draft.bedroomsMin,
    occupants: draft.occupants,
    smoker: draft.smoker,
    hasRentalHistory: draft.hasRentalHistory,
    pets: petsFromDraft(draft),
    creditBand: draft.creditBand,
    incomeBand: draft.incomeBand,
    memberSince,
  };
}

export function sameDraft(a: ProfileDraft, b: ProfileDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
