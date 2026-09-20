import { getAuthUserId } from "@convex-dev/auth/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./activity";
import { getRenter, requireRenter, requireUserId } from "./lib/auth";
import { limits } from "./lib/limits";
import { creditBand, incomeBand, negotiationGoal, pets } from "./lib/validators";

/*
 * The renter profile: search preferences, the private negotiation policy, and
 * the facts shown on the public Passport. `budgetMax` and everything else that
 * is not a Passport fact stays on this side of `passport` below.
 */

const MAX_LIST_ITEMS = 12;
const MAX_LIST_ITEM_CHARS = 60;
const MAX_BIO_CHARS = 600;

// One feed line per renter per 10 minutes, however often the Passport is opened.
const passportNotices = new RateLimiter(components.rateLimiter, {
  passportViewNotice: { kind: "token bucket", rate: 1, period: 10 * MINUTE, capacity: 1 },
});

/*
 * Optional profile fields: leave the key out to keep what is stored, send null
 * or a blank string to clear it. A form can therefore send its whole state, and
 * a partial editor cannot wipe fields it does not show.
 */
const optionalText = v.optional(v.union(v.string(), v.null()));
const optionalNumber = v.optional(v.union(v.number(), v.null()));

const profileArgs = {
  displayName: v.string(),
  headline: optionalText,
  bio: optionalText,
  occupation: optionalText,

  city: v.string(),
  neighborhoods: v.array(v.string()),
  budgetMin: optionalNumber,
  budgetMax: v.number(),
  bedroomsMin: v.number(),
  moveInDate: optionalText, // YYYY-MM-DD
  leaseTermMonths: optionalNumber,
  mustHaves: v.array(v.string()),

  creditBand,
  incomeBand,
  pets,
  occupants: v.number(),
  smoker: v.boolean(),
  hasRentalHistory: v.boolean(),

  negotiationGoals: v.array(negotiationGoal),
};

function requiredText(value: string, label: string, max: number): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length === 0) throw new ConvexError(`${label} is required.`);
  if (text.length > max) throw new ConvexError(`${label} must be ${max} characters or fewer.`);
  return text;
}

/** undefined = clear the field. Only call when the key was provided. */
function cleanOptionalText(
  value: string | null,
  label: string,
  max: number,
  keepLineBreaks = false,
): string | undefined {
  if (value === null) return undefined;
  const text = keepLineBreaks
    ? value.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : value.trim().replace(/\s+/g, " ");
  if (text.length === 0) return undefined;
  if (text.length > max) throw new ConvexError(`${label} must be ${max} characters or fewer.`);
  return text;
}

function cleanList(values: string[], label: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const item = raw.trim().replace(/\s+/g, " ");
    if (item.length === 0) continue;
    if (item.length > MAX_LIST_ITEM_CHARS) {
      throw new ConvexError(`Each entry in ${label} must be ${MAX_LIST_ITEM_CHARS} characters or fewer.`);
    }
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  if (out.length > MAX_LIST_ITEMS) {
    throw new ConvexError(`${label} can have at most ${MAX_LIST_ITEMS} entries.`);
  }
  return out;
}

function wholeNumber(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConvexError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function cleanMoveInDate(value: string | null): string | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (text.length === 0) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match !== null) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    // Date rolls 2026-02-31 over into March; a real calendar day survives the round trip.
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return text;
    }
  }
  throw new ConvexError("Move-in date must be a real date.");
}

function newPassportToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function firstName(displayName: string): string {
  return displayName.split(" ")[0];
}

export const me = query({
  args: {},
  handler: async (ctx): Promise<Doc<"renters"> | null> => {
    return await getRenter(ctx);
  },
});

export const save = mutation({
  args: profileArgs,
  returns: v.id("renters"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (user === null) throw new ConvexError("Please sign in first.");

    const displayName = requiredText(args.displayName, "Your name", 80);
    const city = requiredText(args.city, "City", 80);

    if (!Number.isFinite(args.budgetMax) || args.budgetMax <= 0) {
      throw new ConvexError("Your maximum budget must be more than $0.");
    }
    if (args.budgetMax > 100_000) {
      throw new ConvexError("Your maximum budget looks too high. Enter a monthly amount.");
    }
    const budgetMax = Math.round(args.budgetMax);

    const hasPets = args.pets.hasPets;
    const petDescription = hasPets
      ? cleanOptionalText(args.pets.description ?? null, "Pet description", 120)
      : undefined;

    const required = {
      isGuest: user.isAnonymous === true,
      displayName,
      city,
      neighborhoods: cleanList(args.neighborhoods, "Neighborhoods"),
      budgetMax,
      bedroomsMin: wholeNumber(args.bedroomsMin, "Bedrooms", 0, 6),
      mustHaves: cleanList(args.mustHaves, "Must-haves"),
      creditBand: args.creditBand,
      incomeBand: args.incomeBand,
      pets: petDescription === undefined ? { hasPets } : { hasPets, description: petDescription },
      occupants: wholeNumber(args.occupants, "Occupants", 1, 10),
      smoker: args.smoker,
      hasRentalHistory: args.hasRentalHistory,
      negotiationGoals: [...new Set(args.negotiationGoals)],
    };

    // Only keys the caller sent. A value of undefined clears the stored field.
    const optional: {
      headline?: string;
      bio?: string;
      occupation?: string;
      budgetMin?: number;
      moveInDate?: string;
      leaseTermMonths?: number;
    } = {};
    if (args.headline !== undefined) optional.headline = cleanOptionalText(args.headline, "Headline", 120);
    if (args.bio !== undefined) optional.bio = cleanOptionalText(args.bio, "Bio", MAX_BIO_CHARS, true);
    if (args.occupation !== undefined) {
      optional.occupation = cleanOptionalText(args.occupation, "Occupation", 80);
    }
    if (args.moveInDate !== undefined) optional.moveInDate = cleanMoveInDate(args.moveInDate);
    if (args.leaseTermMonths !== undefined) {
      optional.leaseTermMonths =
        args.leaseTermMonths === null ? undefined : wholeNumber(args.leaseTermMonths, "Lease length", 1, 36);
    }
    if (args.budgetMin !== undefined) {
      if (args.budgetMin === null || args.budgetMin === 0) {
        optional.budgetMin = undefined;
      } else {
        if (!Number.isFinite(args.budgetMin) || args.budgetMin < 0) {
          throw new ConvexError("Your minimum budget cannot be negative.");
        }
        optional.budgetMin = Math.round(args.budgetMin);
      }
    }

    const existing = await ctx.db
      .query("renters")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const budgetMin = "budgetMin" in optional ? optional.budgetMin : existing?.budgetMin;
    if (budgetMin !== undefined && budgetMin > budgetMax) {
      throw new ConvexError("Your minimum budget cannot be higher than your maximum.");
    }

    if (existing !== null) {
      await ctx.db.patch(existing._id, { ...required, ...optional });
      // Match scores depend on budget, pets, move-in date and must-haves.
      await ctx.scheduler.runAfter(0, internal.listings.rescoreAll, { renterId: existing._id });
      return existing._id;
    }

    // insert() rejects explicit undefined values, so drop cleared keys.
    const provided = Object.fromEntries(
      Object.entries(optional).filter(([, value]) => value !== undefined),
    ) as typeof optional;
    const renterId = await ctx.db.insert("renters", {
      userId,
      ...required,
      ...provided,
      passportToken: newPassportToken(),
      passportViews: 0,
      autopilot: false,
    });
    await logActivity(ctx, {
      renterId,
      kind: "system",
      title: `Welcome, ${firstName(displayName)}. Nestor is ready to look for a home in ${city}.`,
      detail: "Paste a listing link, ask the Scout to find some, or load the sample listings to see the whole flow.",
    });
    return renterId;
  },
});

/**
 * `renters.isGuest` mirrors `users.isAnonymous`. Call after a guest creates an
 * account so real-landlord email unlocks without re-saving the profile.
 */
export const syncAccount = mutation({
  args: {},
  returns: v.object({ isGuest: v.boolean() }),
  handler: async (ctx) => {
    const renter = await requireRenter(ctx);
    const user = await ctx.db.get(renter.userId);
    const isGuest = user?.isAnonymous === true;
    if (renter.isGuest !== isGuest) {
      await ctx.db.patch(renter._id, { isGuest });
      if (!isGuest) {
        await logActivity(ctx, {
          renterId: renter._id,
          kind: "system",
          title: "Account created. Nestor can now email real landlords for you.",
        });
      }
    }
    return { isGuest };
  },
});

export const setAutopilot = mutation({
  args: { autopilot: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { autopilot }) => {
    const renter = await requireRenter(ctx);
    if (renter.autopilot === autopilot) return null;
    await ctx.db.patch(renter._id, { autopilot });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "system",
      title: autopilot
        ? "Autopilot is on. Nestor will send emails without waiting for your OK."
        : "Autopilot is off. Every email waits for your approval.",
    });
    return null;
  },
});

/** Replaces the Passport link. The old link stops working immediately. */
export const rotatePassportToken = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const renter = await requireRenter(ctx);
    const passportToken = newPassportToken();
    await ctx.db.patch(renter._id, { passportToken });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "system",
      title: "Your Passport link was replaced. The old link no longer works.",
    });
    return passportToken;
  },
});

// Tokens are 32 hex chars; anything that cannot be one never reaches the index.
function looksLikeToken(token: string): boolean {
  return /^[a-z0-9]{16,64}$/.test(token);
}

/**
 * What a landlord sees at /passport/:token. Unauthenticated: the unguessable
 * token is the capability. The `returns` validator is the allow-list, so a new
 * renters field can never leak by accident. Never budget, email, ids,
 * neighborhoods or negotiation goals.
 */
export const passport = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      displayName: v.string(),
      headline: v.optional(v.string()),
      bio: v.optional(v.string()),
      occupation: v.optional(v.string()),
      city: v.string(),
      moveInDate: v.optional(v.string()),
      leaseTermMonths: v.optional(v.number()),
      bedroomsMin: v.number(),
      occupants: v.number(),
      smoker: v.boolean(),
      hasRentalHistory: v.boolean(),
      pets,
      creditBand,
      incomeBand,
      memberSince: v.number(),
    }),
  ),
  handler: async (ctx, { token }) => {
    if (!looksLikeToken(token)) return null;
    const renter = await ctx.db
      .query("renters")
      .withIndex("by_passport_token", (q) => q.eq("passportToken", token))
      .unique();
    if (renter === null) return null;
    return {
      displayName: renter.displayName,
      headline: renter.headline,
      bio: renter.bio,
      occupation: renter.occupation,
      city: renter.city,
      moveInDate: renter.moveInDate,
      leaseTermMonths: renter.leaseTermMonths,
      bedroomsMin: renter.bedroomsMin,
      occupants: renter.occupants,
      smoker: renter.smoker,
      hasRentalHistory: renter.hasRentalHistory,
      pets: renter.pets,
      creditBand: renter.creditBand,
      incomeBand: renter.incomeBand,
      memberSince: renter._creationTime,
    };
  },
});

/**
 * Called once when the public Passport page mounts. Unauthenticated, so it is
 * rate limited per token and never throws at a landlord's browser.
 */
export const recordPassportView = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    if (!looksLikeToken(token)) return null;
    const renter = await ctx.db
      .query("renters")
      .withIndex("by_passport_token", (q) => q.eq("passportToken", token))
      .unique();
    // Look the renter up first so junk tokens cannot fill the limiter's table.
    if (renter === null) return null;

    // The renter previewing their own Passport is not a landlord view.
    const viewerId = await getAuthUserId(ctx);
    if (viewerId !== null && viewerId === renter.userId) return null;

    const allowed = await limits.limit(ctx, "passportView", { key: token });
    if (!allowed.ok) return null;

    await ctx.db.patch(renter._id, { passportViews: renter.passportViews + 1 });

    const notice = await passportNotices.limit(ctx, "passportViewNotice", { key: renter._id });
    if (notice.ok) {
      await logActivity(ctx, {
        renterId: renter._id,
        kind: "system",
        title: "A landlord opened your Passport",
        detail: "Someone followed your Passport link. Views are counted, never who viewed.",
      });
    }
    return null;
  },
});
