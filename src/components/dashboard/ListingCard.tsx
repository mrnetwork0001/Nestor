import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, RefreshCw, TriangleAlert, X } from "@/components/icons";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, Skeleton } from "@/components/ui";
import { hostOf, listingName, toastError, type ListingRow } from "@/components/listing/helpers";
import { ListingPhoto } from "@/components/listing/ListingPhoto";
import { MatchScore } from "@/components/listing/MatchScore";
import { cn } from "@/lib/cn";
import { bedsBaths, rent, STAGE_LABEL, STAGE_TONE } from "@/lib/format";

const cardBase =
  "group block overflow-hidden rounded-2xl border border-line bg-card shadow-card animate-rise";

function ScoutingCard({ listing }: { listing: ListingRow }) {
  const host = hostOf(listing.sourceUrl);
  return (
    <Link
      to={`/app/listings/${listing._id}`}
      className={cn(cardBase, "p-3.5")}
      aria-label={host ? `The Scout is reading a listing on ${host}` : "The Scout is unpacking a listing"}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-sky">
        <span className="size-1.5 rounded-full bg-sky animate-pulse-dot" aria-hidden="true" />
        {listing.status === "queued" ? "Queued for the Scout" : "The Scout is reading"}
      </div>
      <p className="mt-1 truncate text-sm text-ink-soft">{host ?? "Sample listing"}</p>
      <div className="mt-3 space-y-2" aria-hidden="true">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </Link>
  );
}

function FailedCard({ listing }: { listing: ListingRow }) {
  const rescrape = useMutation(api.listings.rescrape);
  const archive = useMutation(api.listings.archive);
  const [busy, setBusy] = useState<"retry" | "remove" | null>(null);
  const host = hostOf(listing.sourceUrl);

  async function run(kind: "retry" | "remove") {
    if (busy !== null) return;
    setBusy(kind);
    try {
      if (kind === "retry") {
        await rescrape({ listingId: listing._id });
        toast.success("The Scout is taking another look.");
      } else {
        await archive({ listingId: listing._id });
      }
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn(cardBase, "border-clay/30 bg-clay-soft/50 p-3.5")}>
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-clay" aria-hidden="true" />
        <div className="min-w-0">
          <Link
            to={`/app/listings/${listing._id}`}
            className="block truncate text-sm font-semibold text-ink hover:text-forest"
          >
            {listing.title ?? host ?? "Listing"}
          </Link>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {listing.error ?? "The Scout could not read this page."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => run("retry")}
          loading={busy === "retry"}
          disabled={busy !== null}
          icon={<RefreshCw className="size-3.5" />}
        >
          Try again
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => run("remove")}
          loading={busy === "remove"}
          disabled={busy !== null}
          icon={<X className="size-3.5" />}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

/** One listing on the pipeline board. `moved` is set for a few seconds after the card changes column. */
export function ListingCard({ listing, moved = false }: { listing: ListingRow; moved?: boolean }) {
  if (listing.status === "queued" || listing.status === "scouting") return <ScoutingCard listing={listing} />;
  if (listing.status === "failed") return <FailedCard listing={listing} />;

  const name = listingName(listing);
  const where = [listing.neighborhood, listing.city].filter(Boolean).join(", ");
  const facts = bedsBaths(listing.bedrooms, listing.bathrooms);
  const stage = listing.thread?.stage;
  const unread = listing.thread?.unread === true;

  return (
    <Link
      to={`/app/listings/${listing._id}`}
      className={cn(
        cardBase,
        // Stacked in a narrow column, photo-left as soon as the card has room: the board stays short enough to watch.
        "flex flex-col transition-[box-shadow,border-color,translate] duration-500 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift @[15rem]:flex-row",
        moved && "border-forest shadow-lift ring-2 ring-forest/25",
      )}
    >
      <div className="relative h-24 w-full shrink-0 @[15rem]:h-auto @[15rem]:min-h-[6.75rem] @[15rem]:w-24">
        <ListingPhoto src={listing.photos[0]} alt={name} className="absolute inset-0 size-full" />
        {listing.isSample && (
          <Badge tone="honey" className="absolute left-1.5 top-1.5 px-2 shadow-sm">
            Sample
          </Badge>
        )}
        <MatchScore score={listing.matchScore} className="absolute bottom-1.5 right-1.5 size-9 shadow-card" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:text-forest">{name}</p>
        {where && <p className="truncate text-xs text-ink-faint">{where}</p>}
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink">
          <span className="font-semibold tabular-nums">{rent(listing.rentMonthly)}</span>
          {facts && <span className="whitespace-nowrap text-xs text-ink-faint">{facts}</span>}
        </p>
        {/* Only when the card is wide enough to spare a line: the strongest reason it fits. */}
        {listing.matchReasons[0] && (
          <p className="hidden items-center gap-1.5 text-xs text-ink-soft @[24rem]:flex">
            <Check className="size-3.5 shrink-0 text-forest" aria-hidden="true" />
            <span className="truncate">{listing.matchReasons[0]}</span>
          </p>
        )}

        {stage && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {/* Keyed on the stage, so the badge rises again each time the conversation moves on. */}
            <span key={stage} className="inline-flex animate-rise">
              <Badge tone={STAGE_TONE[stage]} dot pulse={stage === "drafting" || stage === "awaiting_reply"}>
                {STAGE_LABEL[stage]}
              </Badge>
            </span>
            {unread && (
              <span className="inline-flex animate-rise items-center gap-1.5 text-xs font-semibold text-clay-deep">
                <span className="size-2 rounded-full bg-clay animate-pulse-dot" aria-hidden="true" />
                New reply
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
