import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { logActivity } from "./activity";
import { getRenter, requireOwned, requireRenter } from "./lib/auth";
import { firecrawlLive } from "./lib/integrations";
import { limitOrThrow, limits } from "./lib/limits";
import { cleanEmail, hostMatches, isContactable, propertyName, scrapedListing } from "./lib/listingSchema";
import { scoreListing } from "./lib/matching";
import { SAMPLE_URL_PREFIX, buildSampleListings } from "./lib/sampleListings";
import { contactCandidate } from "./lib/validators";
import schema from "./schema";

/*
 * The renter's listings. Everything slow happens in `scout.ts`: the mutations
 * here insert or flip a row and schedule the Scout, and the dashboard watches
 * the row change from queued to scouting to ready.
 */

const MAX_LISTED = 60;
// Read a little past the cap so sorting by match still sees recent arrivals.
const LIST_WINDOW = 150;

// Firecrawl refuses these outright (HTTP 403), whatever proxy is used.
const UNSUPPORTED_SITES: Array<{ name: string; domains: string[] }> = [
  { name: "Craigslist", domains: ["craigslist.org"] },
  { name: "Facebook", domains: ["facebook.com", "fb.com", "fb.me"] },
];

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|msclkid$|mc_eid$|ref$|ref_src$)/i;

const usd = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "that site";
  }
}

/** A canonical http(s) URL, so the same listing pasted twice is recognised. */
function normalizeListingUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ConvexError("Paste the link to a rental listing.");
  if (trimmed.length > 2000) throw new ConvexError("That link is too long to be a listing page.");

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new ConvexError("That doesn't look like a web link. Paste the full address of the listing page.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConvexError("Nestor can only read http and https links.");
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.endsWith(".local") || host.startsWith("[")) {
    throw new ConvexError("That doesn't look like a public listing page.");
  }
  const blocked = UNSUPPORTED_SITES.find((site) => hostMatches(host, site.domains));
  if (blocked) {
    throw new ConvexError(
      `Firecrawl can't read ${blocked.name} pages, so the Scout can't open that link. ` +
        "Try the same home on Zumper, PadMapper, Apartment List or Redfin.",
    );
  }

  url.hash = "";
  url.username = "";
  url.password = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

/** "The Rail", not "The Rail · Apartments for Rent | PadMapper". */
function shortTitle(listing: Pick<Doc<"listings">, "title">): string | null {
  return propertyName(listing.title ?? null) ?? listing.title ?? null;
}

function headline(listing: Pick<Doc<"listings">, "bedrooms" | "neighborhood" | "city" | "rentMonthly">): string {
  const what =
    listing.bedrooms === undefined ? "a home" : listing.bedrooms === 0 ? "a studio" : `a ${listing.bedrooms}-bed`;
  const where = listing.neighborhood ?? listing.city;
  const price = listing.rentMonthly !== undefined ? ` for ${usd(listing.rentMonthly)}` : "";
  return `Found ${what}${where ? ` in ${where}` : ""}${price}`;
}

function blankListing(renterId: Id<"renters">, sourceUrl: string) {
  return {
    renterId,
    sourceUrl,
    isSample: false,
    fees: [],
    amenities: [],
    photos: [],
    contactCandidates: [],
    matchReasons: [],
    concerns: [],
    archived: false,
  };
}

/**
 * Queues one URL for the Scout unless the renter already has it.
 * Returns the listing id and whether a scrape was scheduled.
 */
async function queueUrl(
  ctx: MutationCtx,
  renterId: Id<"renters">,
  sourceUrl: string,
  delayMs: number,
): Promise<{ listingId: Id<"listings">; scheduled: boolean }> {
  const existing = await ctx.db
    .query("listings")
    .withIndex("by_renter_url", (q) => q.eq("renterId", renterId).eq("sourceUrl", sourceUrl))
    .first();

  if (existing !== null && existing.status !== "failed") {
    if (existing.archived) await ctx.db.patch(existing._id, { archived: false });
    return { listingId: existing._id, scheduled: false };
  }

  let listingId: Id<"listings">;
  if (existing !== null) {
    listingId = existing._id;
    await ctx.db.patch(listingId, { status: "queued", error: undefined, archived: false });
  } else {
    listingId = await ctx.db.insert("listings", { ...blankListing(renterId, sourceUrl), status: "queued" });
  }
  await ctx.scheduler.runAfter(delayMs, internal.scout.scrapeListing, { listingId });
  return { listingId, scheduled: true };
}

// An action that dies with its host never reports back. These are longer than
// the slowest real run: a blocked site is retried for several minutes.
const SCRAPE_WATCHDOG_MS = 8 * 60 * 1000;
const CONTACT_WATCHDOG_MS = 4 * 60 * 1000;

const SAMPLE_REVEAL_FIRST_MS = 900;
const SAMPLE_REVEAL_GAP_MS = 1200;

/** Inserts the bundled listings this renter does not have yet, revealed one at a time. */
async function insertSamples(ctx: MutationCtx, renter: Doc<"renters">): Promise<number> {
  const samples = buildSampleListings(renter, Date.now());
  let added = 0;
  for (const sample of samples) {
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_renter_url", (q) => q.eq("renterId", renter._id).eq("sourceUrl", sample.sourceUrl))
      .first();
    if (existing !== null) {
      if (existing.archived) {
        await ctx.db.patch(existing._id, { archived: false });
        added++;
      }
      continue;
    }
    const listingId = await ctx.db.insert("listings", {
      ...blankListing(renter._id, sample.sourceUrl),
      ...sample,
      isSample: true,
      status: "scouting",
      contactEmailSource: "sample",
    });
    await ctx.scheduler.runAfter(
      SAMPLE_REVEAL_FIRST_MS + added * SAMPLE_REVEAL_GAP_MS,
      internal.listings.revealSample,
      { listingId },
    );
    added++;
  }
  return added;
}

// Public -----------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const renter = await getRenter(ctx);
    if (renter === null) return [];

    const recent = await ctx.db
      .query("listings")
      .withIndex("by_renter", (q) => q.eq("renterId", renter._id).eq("archived", false))
      .order("desc")
      .take(LIST_WINDOW);

    // Listings the Scout is still working on lead, so a fresh paste is always
    // in view; then best match first, then newest.
    const rank = (l: Doc<"listings">): number =>
      l.status === "queued" || l.status === "scouting" ? 101 : (l.matchScore ?? -1);
    const sorted = recent
      .sort((a, b) => rank(b) - rank(a) || b._creationTime - a._creationTime)
      .slice(0, MAX_LISTED);

    return await Promise.all(
      sorted.map(async (listing) => {
        const thread = await ctx.db
          .query("threads")
          .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
          .first();
        return {
          ...listing,
          thread: thread === null ? null : { _id: thread._id, stage: thread.stage, unread: thread.unread },
        };
      }),
    );
  },
});

export const get = query({
  args: { listingId: v.id("listings") },
  returns: v.union(schema.doc("listings"), v.null()),
  handler: async (ctx, { listingId }) => {
    const renter = await getRenter(ctx);
    if (renter === null) return null;
    const listing = await ctx.db.get(listingId);
    return listing !== null && listing.renterId === renter._id ? listing : null;
  },
});

export const addByUrl = mutation({
  args: { url: v.string() },
  returns: v.id("listings"),
  handler: async (ctx, { url }) => {
    const renter = await requireRenter(ctx);
    const sourceUrl = normalizeListingUrl(url);

    const known = await ctx.db
      .query("listings")
      .withIndex("by_renter_url", (q) => q.eq("renterId", renter._id).eq("sourceUrl", sourceUrl))
      .first();
    // Only a scrape that will actually run spends the renter's allowance.
    if (known === null || known.status === "failed") {
      await limitOrThrow(ctx, "scrapeListing", renter._id, "reading new listings", "globalScrape");
    }

    const { listingId, scheduled } = await queueUrl(ctx, renter._id, sourceUrl, 0);
    if (scheduled) {
      await logActivity(ctx, {
        renterId: renter._id,
        kind: "scout",
        title: `Scouting a listing on ${hostOf(sourceUrl)}`,
        detail: "Reading the page for rent, fees, pet policy and availability.",
        listingId,
      });
    }
    return listingId;
  },
});

export const loadSamples = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const renter = await requireRenter(ctx);
    const added = await insertSamples(ctx, renter);
    if (added > 0) {
      await logActivity(ctx, {
        renterId: renter._id,
        kind: "scout",
        title: `Loading ${added} sample listing${added === 1 ? "" : "s"} in ${renter.city}`,
        detail: "Samples are invented homes with a demo landlord, so you can try everything safely.",
      });
    }
    return added;
  },
});

export const discover = mutation({
  args: {},
  returns: v.object({ demo: v.boolean() }),
  handler: async (ctx) => {
    const renter = await requireRenter(ctx);

    if (!firecrawlLive()) {
      const added = await insertSamples(ctx, renter);
      await logActivity(ctx, {
        renterId: renter._id,
        kind: "scout",
        title: "Scout is in demo mode, so it loaded sample listings",
        detail:
          added > 0
            ? "Searching the web needs a Firecrawl key. These samples are invented homes you can practise on."
            : "Searching the web needs a Firecrawl key. Your sample listings are already on the board.",
      });
      return { demo: true };
    }

    await limitOrThrow(ctx, "discoverListings", renter._id, "listing searches", "globalDiscover");
    const beds = renter.bedroomsMin === 0 ? "studios" : `${renter.bedroomsMin}-bed homes`;
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "scout",
      title: `Searching for ${beds} in ${renter.city}`,
      detail: "Looking across rental sites for places that fit your budget.",
    });
    await ctx.scheduler.runAfter(0, internal.scout.discover, { renterId: renter._id });
    return { demo: false };
  },
});

export const findContact = mutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, { listingId }) => {
    const { renter, doc: listing } = await requireOwned(ctx, "listings", listingId);
    if (listing.isSample) {
      throw new ConvexError("Sample listings talk to Nestor's demo landlord, so there is no email to find.");
    }
    if (listing.status !== "ready") {
      throw new ConvexError("The Scout is still reading this listing. Try again in a moment.");
    }
    if (!firecrawlLive()) {
      throw new ConvexError(
        "The Scout is in demo mode and can't search the web. Type the landlord's email in yourself instead.",
      );
    }
    if (listing.contactSearch === "searching") return null;

    // Guests cannot email real landlords, so a paid search for the address would be wasted.
    if (renter.isGuest) {
      throw new ConvexError("Create a free account to look up real landlords. Guests can try the demo landlord.");
    }
    await limitOrThrow(ctx, "findContact", renter._id, "contact searches", "globalFindContact");
    await ctx.db.patch(listingId, { contactSearch: "searching" });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "scout",
      title: `Looking for the leasing office behind ${shortTitle(listing) ?? "this listing"}`,
      detail: "Rental portals hide landlord emails, so the Scout checks the property's own website.",
      listingId,
    });
    await ctx.scheduler.runAfter(0, internal.scout.findContact, { listingId });
    await ctx.scheduler.runAfter(CONTACT_WATCHDOG_MS, internal.listings.expireStuck, { listingId, what: "contact" });
    return null;
  },
});

export const setContactEmail = mutation({
  args: { listingId: v.id("listings"), email: v.string(), fromCandidate: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { listingId, email, fromCandidate }) => {
    const { doc: listing } = await requireOwned(ctx, "listings", listingId);
    if (listing.isSample) {
      throw new ConvexError("Sample listings talk to Nestor's demo landlord and don't need an email.");
    }
    // An empty field takes the address off the listing again.
    if (email.trim() === "") {
      await ctx.db.patch(listingId, { contactEmail: undefined, contactEmailSource: undefined });
      return null;
    }
    const cleaned = cleanEmail(email);
    if (cleaned === null) throw new ConvexError("That doesn't look like an email address.");
    if (!isContactable(cleaned)) {
      throw new ConvexError("That address can't receive an inquiry. Use the leasing office's or landlord's own email.");
    }

    const isCandidate = listing.contactCandidates.some((c) => c.email === cleaned);
    if (fromCandidate === true && !isCandidate) {
      throw new ConvexError("That address isn't one the Scout found for this listing.");
    }
    await ctx.db.patch(listingId, {
      contactEmail: cleaned,
      contactEmailSource: isCandidate ? "scout_search" : "renter",
    });
    return null;
  },
});

export const rescrape = mutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, { listingId }) => {
    const { renter, doc: listing } = await requireOwned(ctx, "listings", listingId);
    if (listing.status === "queued" || listing.status === "scouting") return null;

    if (listing.isSample) {
      // Nothing to fetch: refresh the match against the renter's current profile.
      await ctx.db.patch(listingId, { ...scoreListing(renter, listing), status: "ready", error: undefined });
      return null;
    }

    await limitOrThrow(ctx, "scrapeListing", renter._id, "reading new listings", "globalScrape");
    await ctx.db.patch(listingId, { status: "queued", error: undefined });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "scout",
      title: `Taking another look at ${shortTitle(listing) ?? `the listing on ${hostOf(listing.sourceUrl)}`}`,
      listingId,
    });
    await ctx.scheduler.runAfter(0, internal.scout.scrapeListing, { listingId });
    return null;
  },
});

export const archive = mutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, { listingId }) => {
    await requireOwned(ctx, "listings", listingId);
    await ctx.db.patch(listingId, { archived: true });

    // A dismissed home must not keep negotiating on autopilot.
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .first();
    if (thread && thread.stage !== "closed" && thread.stage !== "declined") {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .take(200);
      for (const m of messages) if (m.status === "draft") await ctx.db.patch(m._id, { status: "discarded" });
      await ctx.db.patch(thread._id, { stage: "closed", unread: false, openQuestions: [] });
      await logActivity(ctx, {
        renterId: thread.renterId,
        kind: "negotiator",
        title: "Closed the conversation because you archived the listing",
        detail: "Nestor will not write or send anything more here.",
        listingId,
        threadId: thread._id,
      });
    }
    return null;
  },
});

// Internal ---------------------------------------------------------------------

export const revealSample = internalMutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, { listingId }) => {
    const listing = await ctx.db.get(listingId);
    if (listing === null || !listing.isSample || listing.status !== "scouting") return null;
    const renter = await ctx.db.get(listing.renterId);
    if (renter === null) return null;

    const match = scoreListing(renter, listing);
    await ctx.db.patch(listingId, { ...match, status: "ready", scrapedAt: Date.now() });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "scout",
      title: headline(listing),
      detail: `Sample listing. ${match.matchScore}% match.${match.matchReasons[0] ? ` ${match.matchReasons[0]}` : ""}`,
      listingId,
    });
    return null;
  },
});

/** First step of a scrape. Null means there is nothing to do. */
export const beginScrape = internalMutation({
  args: { listingId: v.id("listings"), refresh: v.optional(v.boolean()) },
  returns: v.union(v.object({ sourceUrl: v.string(), renterId: v.id("renters") }), v.null()),
  handler: async (ctx, { listingId, refresh }) => {
    const listing = await ctx.db.get(listingId);
    if (listing === null || listing.isSample || listing.sourceUrl.startsWith(SAMPLE_URL_PREFIX)) return null;
    // A background refresh leaves the card alone while it works.
    if (refresh !== true) {
      await ctx.db.patch(listingId, { status: "scouting", error: undefined });
      await ctx.scheduler.runAfter(SCRAPE_WATCHDOG_MS, internal.listings.expireStuck, { listingId, what: "scrape" });
    }
    return { sourceUrl: listing.sourceUrl, renterId: listing.renterId };
  },
});

export const applyScrape = internalMutation({
  args: {
    listingId: v.id("listings"),
    data: scrapedListing,
    refresh: v.optional(v.boolean()),
    replaceUnitFacts: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { listingId, data, refresh, replaceUnitFacts }) => {
    const listing = await ctx.db.get(listingId);
    if (listing === null) return null;
    const renter = await ctx.db.get(listing.renterId);
    if (renter === null) return null;

    // A re-scrape sometimes misses a fact the first pass caught, so a stated
    // fact is only ever replaced by another stated fact.
    const { contactEmail: pageEmail, fees, amenities, photos, ...facts } = data;
    const merged = {
      ...facts,
      // The exception: bedrooms, bathrooms and size describe one unit. When
      // the Scout settled them as a set, or the bedroom count changed, a size
      // or bath count left over from a different floor plan is cleared.
      ...(replaceUnitFacts === true ||
      (data.bedrooms !== undefined && listing.bedrooms !== undefined && data.bedrooms !== listing.bedrooms)
        ? { bedrooms: data.bedrooms, bathrooms: data.bathrooms, sqft: data.sqft }
        : {}),
      fees: fees.length > 0 ? fees : listing.fees,
      amenities: amenities.length > 0 ? amenities : listing.amenities,
      photos: photos.length > 0 ? photos : listing.photos,
    };
    const next = { ...listing, ...merged };
    const match = scoreListing(renter, next);

    // An address the renter chose, or the Scout found, outranks the page's.
    const keepExistingEmail =
      listing.contactEmail !== undefined && listing.contactEmailSource !== "listing";
    const email =
      pageEmail !== undefined && !keepExistingEmail
        ? { contactEmail: pageEmail, contactEmailSource: "listing" as const }
        : {};

    await ctx.db.patch(listingId, {
      ...merged,
      ...email,
      ...match,
      status: "ready",
      error: undefined,
      scrapedAt: Date.now(),
    });

    const before = listing.scrapedAt !== undefined ? listing.rentMonthly : undefined;
    const after = next.rentMonthly;
    if (before !== undefined && after !== undefined && before !== after) {
      const dropped = after < before;
      await logActivity(ctx, {
        renterId: renter._id,
        kind: "scout",
        title: `Rent ${dropped ? "dropped" : "went up"} by ${usd(Math.abs(before - after))} on ${shortTitle(next) ?? "a listing you are tracking"}`,
        detail: dropped
          ? `Now ${usd(after)}/mo, was ${usd(before)}. A price cut is a good moment to negotiate.`
          : `Now ${usd(after)}/mo, was ${usd(before)}.`,
        listingId,
      });
    } else if (refresh !== true) {
      const reason = match.matchReasons[0] ?? match.concerns[0];
      await logActivity(ctx, {
        renterId: renter._id,
        kind: "scout",
        title: headline(next),
        detail: `${match.matchScore}% match.${reason ? ` ${reason}` : ""}`,
        listingId,
      });
    }
    return null;
  },
});

export const failScrape = internalMutation({
  args: {
    listingId: v.id("listings"),
    error: v.string(),
    gone: v.optional(v.boolean()),
    refresh: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { listingId, error, gone, refresh }) => {
    const listing = await ctx.db.get(listingId);
    if (listing === null) return null;

    if (refresh === true) {
      // Keep the facts we already have; only a vanished listing is news.
      if (gone === true) {
        await logActivity(ctx, {
          renterId: listing.renterId,
          kind: "scout",
          title: `${shortTitle(listing) ?? "A listing you are negotiating"} looks like it was taken down`,
          detail: "The page is gone. It may have been rented, so it is worth asking the landlord.",
          listingId,
        });
      }
      await ctx.db.patch(listingId, { scrapedAt: Date.now() });
      return null;
    }

    await ctx.db.patch(listingId, { status: "failed", error });
    await logActivity(ctx, {
      renterId: listing.renterId,
      kind: "scout",
      title: `Couldn't read the listing on ${hostOf(listing.sourceUrl)}`,
      detail: error,
      listingId,
    });
    return null;
  },
});

/**
 * Watchdog. If the action behind a spinner never reported back, say so rather
 * than spin forever. Harmless when the work finished, and when a newer run is
 * still going its own result lands afterwards and wins.
 */
export const expireStuck = internalMutation({
  args: { listingId: v.id("listings"), what: v.union(v.literal("scrape"), v.literal("contact")) },
  returns: v.null(),
  handler: async (ctx, { listingId, what }) => {
    const listing = await ctx.db.get(listingId);
    if (listing === null) return null;
    if (what === "contact") {
      if (listing.contactSearch === "searching") await ctx.db.patch(listingId, { contactSearch: "failed" });
      return null;
    }
    if (listing.status === "scouting") {
      await ctx.db.patch(listingId, {
        status: "failed",
        error: "The Scout lost track of this page before it finished. Try again.",
      });
    }
    return null;
  },
});

/** What the Scout needs to know to search on a renter's behalf. */
export const searchBrief = internalQuery({
  args: { renterId: v.id("renters") },
  returns: v.union(
    v.object({ city: v.string(), bedroomsMin: v.number(), budgetMax: v.number(), neighborhoods: v.array(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, { renterId }) => {
    const renter = await ctx.db.get(renterId);
    if (renter === null) return null;
    return {
      city: renter.city,
      bedroomsMin: renter.bedroomsMin,
      budgetMax: renter.budgetMax,
      neighborhoods: renter.neighborhoods,
    };
  },
});

/**
 * Queues the first `max` URLs the renter does not already have, spaced apart
 * to stay inside Firecrawl's per-minute scrape limit.
 */
export const queueDiscovered = internalMutation({
  args: {
    renterId: v.id("renters"),
    urls: v.array(v.string()),
    max: v.optional(v.number()),
    spacingMs: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, { renterId, urls, max, spacingMs }) => {
    const renter = await ctx.db.get(renterId);
    if (renter === null) return 0;
    const cap = Math.min(Math.max(max ?? 4, 0), 4);
    const spacing = spacingMs ?? 6000;

    let queued = 0;
    for (const raw of urls.slice(0, 40)) {
      if (queued >= cap) break;
      let sourceUrl: string;
      try {
        sourceUrl = normalizeListingUrl(raw);
      } catch {
        continue;
      }
      // Discovered scrapes skip the renter's own bucket, but not the deployment's daily ceiling.
      if (!(await limits.check(ctx, "globalScrape")).ok) break;
      const { scheduled } = await queueUrl(ctx, renterId, sourceUrl, queued * spacing);
      if (scheduled) {
        await limits.limit(ctx, "globalScrape");
        queued++;
      }
    }

    await logActivity(ctx, {
      renterId,
      kind: "scout",
      title:
        queued > 0
          ? `Found ${queued} new listing${queued === 1 ? "" : "s"} in ${renter.city} to look at`
          : `No new listings turned up in ${renter.city} this time`,
      detail:
        queued > 0
          ? "Reading each one now. They will appear on your board as they finish."
          : "Everything the Scout found is already on your board. Paste a link to add a specific home.",
    });
    return queued;
  },
});

export const contactBrief = internalQuery({
  args: { listingId: v.id("listings") },
  returns: v.union(
    v.object({
      renterId: v.id("renters"),
      sourceUrl: v.string(),
      title: v.union(v.string(), v.null()),
      address: v.union(v.string(), v.null()),
      city: v.union(v.string(), v.null()),
      contactName: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, { listingId }) => {
    const listing = await ctx.db.get(listingId);
    if (listing === null) return null;
    const renter = await ctx.db.get(listing.renterId);
    return {
      renterId: listing.renterId,
      sourceUrl: listing.sourceUrl,
      title: listing.title ?? null,
      address: listing.address ?? null,
      city: listing.city ?? renter?.city ?? null,
      contactName: listing.contactName ?? null,
    };
  },
});

export const saveContactSearch = internalMutation({
  args: {
    listingId: v.id("listings"),
    candidates: v.array(contactCandidate),
    sitesChecked: v.array(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { listingId, candidates, sitesChecked, error }) => {
    const listing = await ctx.db.get(listingId);
    if (listing === null) return null;

    // Validated again here: this is the last stop before an address can be emailed.
    const clean = candidates
      .flatMap((c) => {
        const email = cleanEmail(c.email);
        return email !== null && isContactable(email) ? [{ ...c, email }] : [];
      })
      .slice(0, 5);

    const failed = error !== undefined && clean.length === 0;
    await ctx.db.patch(listingId, {
      contactCandidates: clean,
      contactSearch: failed ? "failed" : "done",
    });

    const name = shortTitle(listing) ?? "this listing";
    const sites = [...new Set(sitesChecked)].slice(0, 3).join(", ");
    await logActivity(ctx, {
      renterId: listing.renterId,
      kind: "scout",
      title: failed
        ? `The contact search for ${name} didn't finish`
        : clean.length > 0
          ? `Found ${clean.length} published email${clean.length === 1 ? "" : "s"} for ${name}`
          : `No published email found for ${name}`,
      detail: failed
        ? error
        : clean.length > 0
          ? "Each one was printed on the property's own site. Pick the one to write to."
          : `${sites ? `Checked ${sites}. ` : "No leasing office site turned up. "}Nestor never guesses an address, so add one if you have it.`,
      listingId,
    });
    return null;
  },
});

/** Re-scores every listing after the renter edits their profile. */
export const rescoreAll = internalMutation({
  args: { renterId: v.id("renters") },
  returns: v.number(),
  handler: async (ctx, { renterId }) => {
    const renter = await ctx.db.get(renterId);
    if (renter === null) return 0;
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_renter", (q) => q.eq("renterId", renterId).eq("archived", false))
      .order("desc")
      .take(LIST_WINDOW);
    let rescored = 0;
    for (const listing of listings) {
      if (listing.status !== "ready") continue;
      await ctx.db.patch(listing._id, scoreListing(renter, listing));
      rescored++;
    }
    return rescored;
  },
});
