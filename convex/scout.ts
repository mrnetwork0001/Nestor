import { FirecrawlClient, type ScrapeOptions } from "@firecrawl/firecrawl-convex";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { firecrawlLive } from "./lib/integrations";
import {
  LISTING_JSON_SCHEMA,
  LISTING_PROMPT,
  PORTAL_DOMAINS,
  extractPublishedEmails,
  hostMatches,
  looksEmpty,
  mentionsProperty,
  normalizeListing,
  propertyName,
} from "./lib/listingSchema";

/*
 * The Scout: everything that talks to Firecrawl. Each action is scheduled by a
 * mutation in `listings.ts` and reports back through an internal mutation
 * there, so the dashboard only ever watches rows change.
 */

const firecrawl = new FirecrawlClient(components.firecrawl);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Firecrawl's free tier allows 10 scrapes a minute.
const SCRAPE_SPACING_MS = 6000;

const DEMO_MODE_ERROR =
  "The Scout is in demo mode because no Firecrawl key is connected. Load the sample listings to try Nestor.";
const OTHER_SITES = "Try the same home on Zumper, PadMapper, Apartment List or Redfin.";
const SEARCH_ERROR = "The web search hit an error. Try again in a minute.";

type Page = {
  url: string;
  json?: unknown;
  markdown?: string;
  images?: string[];
  links?: string[];
  title?: string;
  statusCode?: number;
};

type FirecrawlFailure = { code?: string; status?: number; message?: string };

function firecrawlFailure(err: unknown): FirecrawlFailure | null {
  if (!(err instanceof ConvexError)) return null;
  const data = err.data as unknown;
  if (data === null || typeof data !== "object") return null;
  const { code, status, message } = data as Record<string, unknown>;
  if (typeof code !== "string" || !code.startsWith("firecrawl_")) return null;
  return {
    code,
    status: typeof status === "number" ? status : undefined,
    message: typeof message === "string" ? message : undefined,
  };
}

/** Turns a Firecrawl error into a sentence a renter can act on. */
function explain(err: unknown, fallback = "The Scout couldn't read that page. Check the link and try again."): string {
  const failure = firecrawlFailure(err);
  const message = (failure?.message ?? (err instanceof Error ? err.message : "")).toLowerCase();
  if (failure?.code === "firecrawl_missing_api_key") return DEMO_MODE_ERROR;
  switch (failure?.status) {
    case 401:
      return "Firecrawl rejected Nestor's API key, so the Scout can't read pages right now.";
    case 402:
      return "Nestor has run out of Firecrawl credits. Sample listings still work.";
    case 403:
      return `Firecrawl doesn't support this site. ${OTHER_SITES}`;
    case 429:
      return "The Scout is being rate limited. Give it a minute and try again.";
  }
  if (failure?.status === 408 || message.includes("timed out") || message.includes("timeout")) {
    return `The page took too long to load. Try again, or ${OTHER_SITES.toLowerCase()}`;
  }
  if (failure?.status !== undefined && failure.status >= 500) {
    return `That site blocked the Scout. ${OTHER_SITES}`;
  }
  return fallback;
}

/**
 * Same request the component makes, keeping only the fields the Scout uses.
 * Only reached when the component's answer could not cross the Convex
 * boundary; see `readPage`.
 */
async function readPageDirect(url: string, options: ScrapeOptions): Promise<Page> {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, origin: "nestor", ...options }),
  });
  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: {
      json?: unknown;
      markdown?: string;
      images?: string[];
      links?: string[];
      metadata?: { title?: unknown; statusCode?: unknown };
    };
  } | null;

  if (!response.ok || body === null || body.success === false || body.data === undefined) {
    throw new ConvexError({
      code: "firecrawl_request_failed",
      status: response.status,
      message: body?.error ?? response.statusText,
    });
  }
  const { json, markdown, images, links, metadata } = body.data;
  return {
    url,
    json,
    markdown,
    images,
    links,
    title: typeof metadata?.title === "string" ? metadata.title : undefined,
    statusCode: typeof metadata?.statusCode === "number" ? metadata.statusCode : undefined,
  };
}

async function readPage(ctx: ActionCtx, url: string, options: ScrapeOptions): Promise<Page> {
  try {
    const doc = await firecrawl.scrape(ctx, url, options);
    return {
      url,
      json: doc.json,
      markdown: doc.markdown,
      images: doc.images,
      links: doc.links,
      title: typeof doc.metadata?.title === "string" ? doc.metadata.title : undefined,
      statusCode: doc.metadata?.statusCode,
    };
  } catch (err) {
    // A ConvexError with a firecrawl_ code is Firecrawl's real answer.
    if (firecrawlFailure(err) !== null) throw err;
    // Anything else is the component failing to return: it passes every <meta>
    // tag through, and Convex refuses object keys that start with "$" or are
    // not plain ASCII. The page itself is fine, so ask again without them.
    console.warn(`Scout: component scrape did not return for ${new URL(url).hostname}; retrying directly`);
    return await readPageDirect(url, options);
  }
}

// These portals only load the floor plan table, the fees and the pet policy
// once they scroll into view; until then the page says "One sec, gathering the
// Policies and fees". Without them the extractor guesses.
const LAZY_HOSTS = ["zumper.com", "padmapper.com"];
const SCROLL_THROUGH: unknown[] = Array.from({ length: 10 }).flatMap(() => [
  { type: "scroll", direction: "down" },
  { type: "wait", milliseconds: 400 },
]);

export const scrapeListing = internalAction({
  args: { listingId: v.id("listings"), refresh: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { listingId, refresh }): Promise<null> => {
    const job: { sourceUrl: string; renterId: Id<"renters"> } | null = await ctx.runMutation(
      internal.listings.beginScrape,
      { listingId, refresh },
    );
    if (job === null) return null;

    if (!firecrawlLive()) {
      await ctx.runMutation(internal.listings.failScrape, { listingId, error: DEMO_MODE_ERROR, refresh });
      return null;
    }

    // A building page lists many floor plans; which one the card shows depends
    // on how many bedrooms this renter needs.
    const brief: { bedroomsMin: number } | null = await ctx.runQuery(internal.listings.searchBrief, {
      renterId: job.renterId,
    });

    try {
      const page = await readPage(ctx, job.sourceUrl, {
        formats: [
          "markdown",
          "images",
          { type: "json", schema: LISTING_JSON_SCHEMA as unknown as Record<string, unknown>, prompt: LISTING_PROMPT },
        ],
        onlyMainContent: true,
        ...(hostMatches(new URL(job.sourceUrl).hostname, LAZY_HOSTS) ? { actions: SCROLL_THROUGH } : {}),
        timeout: 90_000,
        // A refresh exists to catch price changes, so Firecrawl's cache is no use.
        maxAge: refresh === true ? 0 : HOUR_MS,
        proxy: "auto",
        blockAds: true,
      });

      // Firecrawl reports success for an error page; the status is the listing site's.
      if (page.statusCode === 404 || page.statusCode === 410) {
        await ctx.runMutation(internal.listings.failScrape, {
          listingId,
          error: "This listing looks like it was taken down. It may already be rented.",
          gone: true,
          refresh,
        });
        return null;
      }
      if (page.statusCode !== undefined && page.statusCode >= 400) {
        await ctx.runMutation(internal.listings.failScrape, {
          listingId,
          error: `The listing site answered with an error (HTTP ${page.statusCode}). ${OTHER_SITES}`,
          refresh,
        });
        return null;
      }

      const { listing: data, replaceUnitFacts } = normalizeListing(page.json, {
        title: page.title ?? new URL(job.sourceUrl).hostname,
        images: page.images,
        pageText: page.markdown,
        bedroomsMin: brief?.bedroomsMin,
      });
      if (looksEmpty(data)) {
        await ctx.runMutation(internal.listings.failScrape, {
          listingId,
          error:
            "The Scout couldn't find rental details on that page. Paste the link to one listing or building, not a search page.",
          refresh,
        });
        return null;
      }
      await ctx.runMutation(internal.listings.applyScrape, { listingId, data, refresh, replaceUnitFacts });
    } catch (err) {
      console.error("Scout: scrape failed", firecrawlFailure(err) ?? (err instanceof Error ? err.message : err));
      await ctx.runMutation(internal.listings.failScrape, { listingId, error: explain(err), refresh });
    }
    return null;
  },
});

// Discovery --------------------------------------------------------------------

// Flaky or hostile to scrapers: a failed card is a worse demo than a missing one.
const DISCOVERY_EXCLUDED = ["craigslist.org", "facebook.com", "apartments.com", "zillow.com"];

const INDEX_HOSTS = ["zumper.com", "padmapper.com", "apartmentlist.com", "redfin.com", "realtor.com", "trulia.com"];

const DETAIL_PAGE = new RegExp(
  [
    "zumper\\.com/(apartment-buildings|address)/[^/]+",
    "zumper\\.com/apartments-for-rent/\\d+",
    "padmapper\\.com/buildings/[^/]+",
    "padmapper\\.com/apartments/\\d+",
    "apartmentlist\\.com/[a-z]{2}/[a-z0-9-]+/(?!.*(apartments|bedroom|studio|houses|homes|condos|townhomes|neighborhoods|cheap|luxury|pet-friendly|near-))[a-z0-9-]+/?$",
    "redfin\\.com/.+/(apartment|home)/\\d+",
    "realtor\\.com/rentals/details/",
    "trulia\\.com/(building|home|p)/",
  ].join("|"),
  "i",
);

function cleanLink(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isDetailPage(url: string): boolean {
  return DETAIL_PAGE.test(url) && !hostMatches(new URL(url).hostname, DISCOVERY_EXCLUDED);
}

export const discover = internalAction({
  args: {
    renterId: v.id("renters"),
    maxListings: v.optional(v.number()),
    maxIndexPages: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { renterId, maxListings, maxIndexPages }): Promise<null> => {
    const brief: { city: string; bedroomsMin: number; budgetMax: number; neighborhoods: string[] } | null =
      await ctx.runQuery(internal.listings.searchBrief, { renterId });
    if (brief === null) return null;
    const wanted = Math.min(Math.max(maxListings ?? 4, 0), 4);
    const indexBudget = Math.min(Math.max(maxIndexPages ?? 2, 0), 2);

    if (!firecrawlLive()) {
      await ctx.runMutation(internal.activity.log, {
        renterId,
        kind: "scout",
        title: "The Scout can't search the web in demo mode",
        detail: "Connect a Firecrawl key to discover real listings, or load the sample listings.",
      });
      return null;
    }

    const beds = brief.bedroomsMin === 0 ? "studio" : `${brief.bedroomsMin} bedroom`;
    const query = `${beds} apartments for rent in ${brief.city} under $${Math.round(brief.budgetMax)}`;

    try {
      const results = await firecrawl.search(ctx, query, {
        limit: 8,
        sources: ["web"],
        excludeDomains: DISCOVERY_EXCLUDED,
      });
      const hits = (results.web ?? []).flatMap((r) => cleanLink(r.url) ?? []);

      const found = new Set<string>(hits.filter(isDetailPage));
      const indexPages = hits.filter((u) => !isDetailPage(u) && hostMatches(new URL(u).hostname, INDEX_HOSTS));

      // Searches mostly return a portal's city page, so the listings on it are
      // harvested from its links. One cheap scrape each, and only while short.
      let harvested = 0;
      for (const indexUrl of indexPages) {
        // Ask for spares: some will already be on the renter's board.
        if (found.size >= wanted * 3 || harvested >= indexBudget) break;
        harvested++;
        try {
          const page = await readPage(ctx, indexUrl, {
            formats: ["links"],
            onlyMainContent: true,
            maxAge: HOUR_MS,
            timeout: 60_000,
            proxy: "auto",
          });
          for (const link of page.links ?? []) {
            const clean = cleanLink(link);
            if (clean !== null && isDetailPage(clean)) found.add(clean);
          }
        } catch (err) {
          console.warn("Scout: could not read index page", firecrawlFailure(err) ?? err);
        }
      }

      if (found.size === 0) {
        await ctx.runMutation(internal.activity.log, {
          renterId,
          kind: "scout",
          title: `The search for ${brief.city} didn't turn up listing pages`,
          detail: "Paste a link from Zumper, PadMapper, Apartment List or Redfin and the Scout will read it.",
        });
        return null;
      }

      await ctx.runMutation(internal.listings.queueDiscovered, {
        renterId,
        urls: [...found].slice(0, 24),
        max: wanted,
        spacingMs: SCRAPE_SPACING_MS,
      });
    } catch (err) {
      console.error("Scout: discovery failed", firecrawlFailure(err) ?? (err instanceof Error ? err.message : err));
      await ctx.runMutation(internal.activity.log, {
        renterId,
        kind: "scout",
        title: "The search for new listings didn't finish",
        detail: explain(err, SEARCH_ERROR),
      });
    }
    return null;
  },
});

// Landlord contact ---------------------------------------------------------------

const CONTACT_PAGES_DEFAULT = 3;
const CANDIDATES_MAX = 5;

export const findContact = internalAction({
  args: { listingId: v.id("listings"), maxPages: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { listingId, maxPages }): Promise<null> => {
    const brief: {
      renterId: Id<"renters">;
      sourceUrl: string;
      title: string | null;
      address: string | null;
      city: string | null;
      contactName: string | null;
    } | null = await ctx.runQuery(internal.listings.contactBrief, { listingId });
    if (brief === null) return null;

    const finish = async (
      candidates: Array<{ email: string; sourceUrl: string; label?: string }>,
      sitesChecked: string[],
      error?: string,
    ): Promise<null> => {
      await ctx.runMutation(internal.listings.saveContactSearch, { listingId, candidates, sitesChecked, error });
      return null;
    };

    if (!firecrawlLive()) return await finish([], [], DEMO_MODE_ERROR);

    const name = propertyName(brief.title);
    if (name === null && brief.address === null) {
      return await finish([], [], "The Scout needs a building name or street address to look up the leasing office.");
    }

    const pageBudget = Math.min(Math.max(maxPages ?? CONTACT_PAGES_DEFAULT, 1), CONTACT_PAGES_DEFAULT);
    const quoted = name !== null && name.includes(" ") ? `"${name}"` : name;
    const query = [quoted, brief.address, brief.city, "leasing office contact email"].filter(Boolean).join(" ");

    try {
      const results = await firecrawl.search(ctx, query, {
        limit: 8,
        sources: ["web"],
        // The API takes a short list; the full portal list is applied below.
        excludeDomains: PORTAL_DOMAINS.slice(0, 10),
      });

      const perHost = new Map<string, number>();
      const pages = (results.web ?? [])
        .flatMap((r, position) => {
          const url = cleanLink(r.url);
          if (url === null) return [];
          const host = new URL(url).hostname;
          if (hostMatches(host, PORTAL_DOMAINS) || /\.(pdf|jpg|png)$/i.test(url)) return [];
          const snippet = [r.title, r.description, host.replace(/[.-]/g, " ")]
            .filter((s): s is string => typeof s === "string")
            .join(" ");
          return [{ url, host, position, snippet, isContactPage: /contact|leasing|about/i.test(new URL(url).pathname) }];
        })
        // The contact page is where an address is most likely to be printed.
        .sort((a, b) => Number(b.isContactPage) - Number(a.isContactPage) || a.position - b.position)
        .filter((p) => {
          const seen = perHost.get(p.host) ?? 0;
          perHost.set(p.host, seen + 1);
          return seen < 2;
        });

      const candidates = new Map<string, { email: string; sourceUrl: string; label: string; rank: number }>();
      const sitesChecked: string[] = [];
      for (const target of pages) {
        if (sitesChecked.length >= pageBudget || candidates.size >= CANDIDATES_MAX) break;
        let page: Page;
        try {
          sitesChecked.push(target.host.replace(/^www\./, ""));
          page = await readPage(ctx, target.url, {
            formats: ["markdown", "links"],
            // Emails live in footers and sidebars, which "main content" strips.
            onlyMainContent: false,
            maxAge: DAY_MS,
            timeout: 45_000,
            proxy: "auto",
            blockAds: true,
          });
        } catch (err) {
          console.warn("Scout: could not read contact page", firecrawlFailure(err) ?? err);
          continue;
        }
        if (page.statusCode !== undefined && page.statusCode >= 400) continue;

        const mailtos = (page.links ?? []).filter((l) => typeof l === "string" && l.toLowerCase().startsWith("mailto:"));
        const pageText = [page.markdown ?? "", ...mailtos].join("\n");
        // Another building with a similar name is worse than no result.
        if (!mentionsProperty(`${target.snippet} ${pageText}`, name, brief.address)) continue;

        for (const found of extractPublishedEmails(pageText, target.host)) {
          if (candidates.size >= CANDIDATES_MAX) break;
          if (!candidates.has(found.email)) {
            candidates.set(found.email, { email: found.email, sourceUrl: target.url, label: found.label, rank: found.rank });
          }
        }
      }

      const ranked = [...candidates.values()]
        .sort((a, b) => a.rank - b.rank)
        .map(({ email, sourceUrl, label }) => ({ email, sourceUrl, label }));
      return await finish(ranked, sitesChecked);
    } catch (err) {
      console.error("Scout: contact search failed", firecrawlFailure(err) ?? (err instanceof Error ? err.message : err));
      return await finish([], [], explain(err, SEARCH_ERROR));
    }
  },
});

// Scheduled refresh ----------------------------------------------------------------

const REFRESH_BATCH = 5;
const REFRESH_SCAN = 400;

/**
 * Cron target. Re-reads listings that are under negotiation so a price cut
 * shows up in the feed. Five credits each, so the batch stays small.
 */
export const refreshStale = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    if (!firecrawlLive()) return 0;
    const cutoff = Date.now() - DAY_MS;
    const ready = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .order("desc")
      .take(REFRESH_SCAN);

    let scheduled = 0;
    for (const listing of ready) {
      if (scheduled >= REFRESH_BATCH) break;
      if (listing.isSample || listing.archived) continue;
      if (listing.scrapedAt === undefined || listing.scrapedAt > cutoff) continue;
      const thread = await ctx.db
        .query("threads")
        .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
        .first();
      if (thread === null || thread.stage === "closed" || thread.stage === "declined") continue;

      await ctx.scheduler.runAfter(scheduled * SCRAPE_SPACING_MS, internal.scout.scrapeListing, {
        listingId: listing._id,
        refresh: true,
      });
      scheduled++;
    }
    return scheduled;
  },
});
