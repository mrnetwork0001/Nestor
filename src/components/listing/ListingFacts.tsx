import { useState, type ReactNode } from "react";
import { Check, CircleAlert } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Card } from "@/components/ui";
import { dayLabel, money } from "@/lib/format";
import { MatchScore, matchWord } from "./MatchScore";

type Listing = Doc<"listings">;

const CADENCE_LABEL: Record<string, string> = {
  one_time: "one time",
  monthly: "every month",
  unknown: "",
};

function availability(value: string | undefined): string | null {
  if (!value) return null;
  // The Scout stores either an ISO date or the listing's own words ("now", "early October").
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dayLabel(value);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-[0.1em] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export function MatchPanel({ listing }: { listing: Listing }) {
  if (listing.matchScore === undefined && listing.matchReasons.length === 0 && listing.concerns.length === 0) {
    return null;
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <MatchScore score={listing.matchScore} size="lg" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">How it fits you</p>
          <h2 className="text-xl text-ink">
            {listing.matchScore !== undefined ? matchWord(listing.matchScore) : "Match"}
          </h2>
        </div>
      </div>

      {listing.matchReasons.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {listing.matchReasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-sm text-ink-soft">
              <Check className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
      )}

      {listing.concerns.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm font-semibold text-ink">Worth raising with the landlord</p>
          <ul className="mt-2 space-y-1.5">
            {listing.concerns.map((concern) => (
              <li key={concern} className="flex gap-2 text-sm text-ink-soft">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-honey" aria-hidden="true" />
                {concern}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-ink-faint">
            The Negotiator uses these as leverage. It never mentions your budget.
          </p>
        </div>
      )}
    </Card>
  );
}

export function ListingFacts({ listing }: { listing: Listing }) {
  const [expanded, setExpanded] = useState(false);
  const available = availability(listing.availableDate);
  const description = listing.description?.trim();
  const longDescription = description !== undefined && description.length > 320;

  const oneTime = listing.fees.reduce((sum, f) => sum + (f.cadence === "one_time" ? (f.amount ?? 0) : 0), 0);
  const monthly = listing.fees.reduce((sum, f) => sum + (f.cadence === "monthly" ? (f.amount ?? 0) : 0), 0);

  return (
    <Card className="divide-y divide-line">
      <div className="p-5">
        <h2 className="text-xl text-ink">The details</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Fact label="Rent">{listing.rentMonthly !== undefined ? `${money(listing.rentMonthly)} / month` : "Not listed"}</Fact>
          <Fact label="Bedrooms">
            {listing.bedrooms === undefined ? "Not listed" : listing.bedrooms === 0 ? "Studio" : listing.bedrooms}
          </Fact>
          <Fact label="Bathrooms">{listing.bathrooms ?? "Not listed"}</Fact>
          <Fact label="Size">
            {listing.sqft !== undefined ? `${listing.sqft.toLocaleString("en-US")} sq ft` : "Not listed"}
          </Fact>
          <Fact label="Available">{available ?? "Not listed"}</Fact>
          <Fact label="Lease">
            {listing.leaseTermMonths !== undefined ? `${listing.leaseTermMonths} months` : "Not listed"}
          </Fact>
          <Fact label="Deposit">{listing.deposit !== undefined ? money(listing.deposit) : "Not listed"}</Fact>
          <div className="col-span-2">
            <Fact label="Pets">{listing.petPolicy ?? "Not listed"}</Fact>
          </div>
        </dl>
      </div>

      <div className="p-5">
        <h3 className="text-base text-ink">Fees</h3>
        {listing.fees.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-soft">
            No fees are published on the listing. The Negotiator will ask before you commit to anything.
          </p>
        ) : (
          <>
            <ul className="mt-2.5 divide-y divide-line/70">
              {listing.fees.map((fee, i) => (
                <li key={`${fee.label}:${i}`} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <span className="text-ink-soft">{fee.label}</span>
                  <span className="shrink-0 text-right font-medium tabular-nums text-ink">
                    {fee.amount !== undefined ? money(fee.amount) : "Amount not listed"}
                    {fee.cadence && CADENCE_LABEL[fee.cadence] && (
                      <span className="ml-1.5 font-normal text-ink-faint">{CADENCE_LABEL[fee.cadence]}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {(oneTime > 0 || monthly > 0) && (
              <p className="mt-2.5 text-xs text-ink-faint">
                {[
                  oneTime > 0 ? `${money(oneTime)} up front` : null,
                  monthly > 0 ? `${money(monthly)} a month on top of rent` : null,
                ]
                  .filter(Boolean)
                  .join(" and ")}
                . Fees are often the easiest thing to negotiate.
              </p>
            )}
          </>
        )}
      </div>

      {listing.amenities.length > 0 && (
        <div className="p-5">
          <h3 className="text-base text-ink">Amenities</h3>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {listing.amenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full border border-line bg-paper-deep/60 px-2.5 py-1 text-xs text-ink-soft"
              >
                {amenity}
              </li>
            ))}
          </ul>
        </div>
      )}

      {description && (
        <div className="p-5">
          <h3 className="text-base text-ink">From the listing</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {longDescription && !expanded ? `${description.slice(0, 300).trimEnd()}...` : description}
          </p>
          {longDescription && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="mt-1.5 cursor-pointer text-sm font-medium text-forest hover:underline"
            >
              {expanded ? "Show less" : "Read the rest"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
