import type { Doc } from "../_generated/dataModel";
import type { ScrapedListing } from "./listingSchema";

/*
 * Six bundled listings so a guest, or a deployment without a Firecrawl key, can
 * try the whole flow. They are fiction: invented buildings and landlord
 * personas, shaped around the renter's own city, budget and bedroom count so
 * the match scores and the negotiation have something real to chew on. They
 * are always stored with `isSample: true` and never carry an email address.
 */

export type SampleListing = ScrapedListing & { sourceUrl: string; contactName: string };

/** Not a web address on purpose: sample listings have no page to open. */
export const SAMPLE_URL_PREFIX = "sample://nestor/";

const photo = (id: string): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

const FALLBACK_NEIGHBORHOODS = ["Downtown", "Midtown", "Riverside", "Old Town", "Uptown", "Eastside"];

const roundTo = (n: number, step: number): number => Math.max(step, Math.round(n / step) * step);

const bedTitle = (beds: number): string => (beds === 0 ? "studio" : `${beds}-bed`);

function isoDaysFrom(baseMs: number, days: number): string {
  return new Date(baseMs + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * `nowMs` comes from the calling mutation so this module stays free of clocks.
 */
export function buildSampleListings(
  renter: Pick<Doc<"renters">, "city" | "neighborhoods" | "budgetMax" | "bedroomsMin" | "moveInDate">,
  nowMs: number,
): SampleListing[] {
  const budget = renter.budgetMax;
  const beds = renter.bedroomsMin;
  const baths = beds >= 3 ? 2 : 1;
  const hoods = renter.neighborhoods.map((n) => n.trim()).filter(Boolean);
  const hood = (i: number): string =>
    hoods.length > 0 ? hoods[i % hoods.length] : FALLBACK_NEIGHBORHOODS[i % FALLBACK_NEIGHBORHOODS.length];

  const parsedMoveIn = renter.moveInDate ? Date.parse(`${renter.moveInDate}T00:00:00Z`) : Number.NaN;
  // Never offer a date in the past when the renter's move-in date has slipped by.
  const moveIn = Number.isNaN(parsedMoveIn) ? nowMs + 30 * 86_400_000 : Math.max(parsedMoveIn, nowMs + 7 * 86_400_000);

  const rent = (factor: number): number => roundTo(budget * factor, 25);

  return [
    {
      sourceUrl: `${SAMPLE_URL_PREFIX}maple-court`,
      title: `Sunny ${bedTitle(beds)} at Maple Court`,
      address: "1420 Maple Court, Unit 3B",
      city: renter.city,
      neighborhood: hood(0),
      rentMonthly: rent(0.92),
      bedrooms: beds,
      bathrooms: baths,
      sqft: 560 + beds * 210,
      availableDate: isoDaysFrom(moveIn, -10),
      leaseTermMonths: 12,
      deposit: rent(0.92),
      petPolicy: "Dogs and cats welcome, two pets maximum",
      fees: [
        { label: "Application fee", amount: 75, cadence: "one_time" },
        { label: "Pet fee", amount: 350, cadence: "one_time" },
        { label: "Pet rent", amount: 35, cadence: "monthly" },
      ],
      amenities: ["In-unit washer and dryer", "Dishwasher", "Central air", "Hardwood floors", "Bike storage", "Pet friendly"],
      photos: [photo("1522708323590-d24dbb6b0267"), photo("1484154218962-a197022b5858")],
      description:
        "South-facing third-floor unit in a 24-home courtyard building with big windows, an updated kitchen and laundry in the unit. Managed by a small local company.",
      contactName: "Dana Whitfield",
      contactPhone: "(555) 010-0142",
    },
    {
      sourceUrl: `${SAMPLE_URL_PREFIX}the-alder`,
      title: `The Alder: new ${bedTitle(beds)} with rooftop`,
      address: "88 Alder Street",
      city: renter.city,
      neighborhood: hood(1),
      rentMonthly: rent(1.08),
      bedrooms: beds,
      bathrooms: baths,
      sqft: 610 + beds * 220,
      availableDate: "now",
      leaseTermMonths: 13,
      deposit: 500,
      petPolicy: "Pet friendly, no breed restrictions",
      fees: [
        { label: "Administrative fee", amount: 250, cadence: "one_time" },
        { label: "Amenity fee", amount: 60, cadence: "monthly" },
        { label: "Garage parking", amount: 125, cadence: "monthly" },
      ],
      amenities: ["Fitness center", "Rooftop deck", "In-unit washer and dryer", "Garage parking", "Package lockers", "Air conditioning", "Elevator"],
      photos: [photo("1545324418-cc1a3fa10c00"), photo("1554995207-c18c203602cb")],
      description:
        "Brand-new building that opened this year and is still leasing up. The leasing office is advertising one month free on a 13-month lease for select homes.",
      contactName: "Elena Castillo",
      contactPhone: "(555) 010-0177",
    },
    {
      sourceUrl: `${SAMPLE_URL_PREFIX}linden-row`,
      title: `Renovated ${bedTitle(beds)} on Linden Row`,
      address: "307 Linden Row, Apt 2",
      city: renter.city,
      neighborhood: hood(2),
      rentMonthly: rent(0.8),
      bedrooms: beds,
      bathrooms: 1,
      sqft: 520 + beds * 190,
      availableDate: isoDaysFrom(moveIn, -3),
      leaseTermMonths: 12,
      deposit: rent(0.8),
      petPolicy: "No pets",
      fees: [{ label: "Application fee", amount: 40, cadence: "one_time" }],
      amenities: ["Shared laundry in basement", "New kitchen appliances", "Hardwood floors", "Street parking", "Near transit"],
      photos: [photo("1493809842364-78817add7ffb"), photo("1556912173-3bb406ef7e77")],
      description:
        "Second-floor apartment in a 1920s fourplex, renovated last year. Owner lives nearby and manages the building herself. Heat and water are included.",
      contactName: "Priya Raman",
      contactPhone: "(555) 010-0119",
    },
    {
      sourceUrl: `${SAMPLE_URL_PREFIX}kessler-duplex`,
      title: `Garden-level ${bedTitle(beds)} with private patio`,
      address: "2215 Juniper Avenue, Lower",
      city: renter.city,
      neighborhood: hood(3),
      rentMonthly: rent(0.97),
      bedrooms: beds,
      bathrooms: baths,
      sqft: 640 + beds * 200,
      availableDate: isoDaysFrom(moveIn, 0),
      leaseTermMonths: 12,
      deposit: roundTo(budget * 0.97 * 1.5, 25),
      petPolicy: "Cats only, one cat maximum",
      fees: [
        { label: "Application fee", amount: 50, cadence: "one_time" },
        { label: "Pet deposit", amount: 300, cadence: "one_time" },
      ],
      amenities: ["Private patio", "In-unit washer and dryer", "Dishwasher", "Off-street parking", "Shared garden"],
      photos: [photo("1502672260266-1c1ef2d93688"), photo("1586023492125-27b2c045efd7")],
      description:
        "Lower half of a well-kept duplex on a quiet street, with its own entrance and patio. The listing has been up for 38 days.",
      contactName: "Tom Kessler",
      contactPhone: "(555) 010-0163",
    },
    {
      sourceUrl: `${SAMPLE_URL_PREFIX}foundry-lofts`,
      title: `Top-floor ${bedTitle(beds + 1)} loft at The Foundry`,
      address: "51 Foundry Lane, Unit 607",
      city: renter.city,
      neighborhood: hood(4),
      rentMonthly: rent(1.16),
      bedrooms: beds + 1,
      bathrooms: baths + (beds >= 1 ? 1 : 0),
      sqft: 820 + beds * 230,
      availableDate: isoDaysFrom(moveIn, 21),
      leaseTermMonths: 12,
      deposit: rent(1.16),
      petPolicy: "Dogs and cats allowed, 50 lb weight limit",
      fees: [
        { label: "Application fee", amount: 65, cadence: "one_time" },
        { label: "Pet rent", amount: 50, cadence: "monthly" },
        { label: "Trash and pest service", amount: 28, cadence: "monthly" },
      ],
      amenities: ["Exposed brick", "Floor-to-ceiling windows", "In-unit washer and dryer", "Fitness center", "Elevator", "Central air", "Bike storage"],
      photos: [photo("1536376072261-38c75010e6c9"), photo("1560448204-e02f11c3d0e2")],
      description:
        "Corner loft in a converted warehouse with an extra bedroom that works as an office. Above budget as listed, and the current tenant moves out three weeks after the start of the month.",
      contactName: "Marcus Oyelaran",
      contactPhone: "(555) 010-0155",
    },
    {
      sourceUrl: `${SAMPLE_URL_PREFIX}birch-street`,
      title: beds >= 1 ? `Budget-friendly ${bedTitle(beds - 1)} on Birch Street` : "Compact studio on Birch Street",
      address: "964 Birch Street, Apt 12",
      city: renter.city,
      neighborhood: hood(5),
      rentMonthly: rent(0.7),
      bedrooms: Math.max(0, beds - 1),
      bathrooms: 1,
      sqft: Math.max(380, 420 + (beds - 1) * 180),
      availableDate: "now",
      leaseTermMonths: 12,
      deposit: 400,
      petPolicy: "Pets considered case by case",
      fees: [
        { label: "Application fee", amount: 35, cadence: "one_time" },
        { label: "Surface parking", amount: 60, cadence: "monthly" },
      ],
      amenities: ["Laundry on each floor", "Air conditioning", "Surface parking", "On-site manager", "Near transit"],
      photos: [photo("1567767292278-a4f21aa2d36e"), photo("1560185127-6ed189bf02f4")],
      description:
        "A smaller, cheaper option in a 40-unit mid-century building with an on-site manager. Vacant and ready now; the manager says she is flexible on the lease length.",
      contactName: "Gloria Benning",
      contactPhone: "(555) 010-0128",
    },
  ];
}
