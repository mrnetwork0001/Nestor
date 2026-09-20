import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ExternalLink, MapPin, RefreshCw, SearchX, TriangleAlert } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { ContactBlock } from "@/components/listing/ContactBlock";
import { hostOf, isWebUrl, listingName, toastError } from "@/components/listing/helpers";
import { ListingFacts, MatchPanel } from "@/components/listing/ListingFacts";
import { NotFoundBoundary } from "@/components/listing/NotFoundBoundary";
import { PhotoGallery } from "@/components/listing/PhotoGallery";
import { Conversation } from "@/components/thread/Conversation";
import { StartNegotiation } from "@/components/thread/StartNegotiation";
import { Badge, Button, Callout, Card, EmptyState, Skeleton } from "@/components/ui";
import { bedsBaths, money, STAGE_LABEL, STAGE_TONE } from "@/lib/format";

const shell = "mx-auto w-full max-w-[84rem] px-5 py-8 sm:px-8 lg:py-10";

function BackLink() {
  return (
    <Link
      to="/app"
      className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft transition-colors hover:text-forest"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Dashboard
    </Link>
  );
}

function ListingMissing() {
  return (
    <div className={shell}>
      <BackLink />
      <EmptyState
        className="mt-6"
        icon={<SearchX className="size-5" />}
        title="We could not find that listing"
        body="It may have been removed from your board, or the link is incomplete."
        action={
          <Link
            to="/app"
            className="inline-flex h-10 items-center rounded-xl bg-forest px-4 text-sm font-medium text-paper hover:bg-forest-deep"
          >
            Back to your dashboard
          </Link>
        }
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className={shell} aria-busy="true" aria-label="Loading the listing">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-5 h-9 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-4">
          <Skeleton className="aspect-[16/10] w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
        </div>
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    </div>
  );
}

/** The Scout is still reading the page: say so, and let the rest of the view fill in when the row flips. */
function ScoutingState({ listing }: { listing: Doc<"listings"> }) {
  const host = hostOf(listing.sourceUrl);
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-sky">
        <span className="size-2 rounded-full bg-sky animate-pulse-dot" aria-hidden="true" />
        {listing.status === "queued" ? "Queued for the Scout" : "The Scout is reading this page"}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {host
          ? `Firecrawl is opening ${host} and pulling out the rent, fees, pet policy, availability and photos. `
          : "Unpacking the details. "}
        This page fills in on its own when it finishes, usually within half a minute.
      </p>
      <div className="mt-5 space-y-3" aria-hidden="true">
        <Skeleton className="aspect-[16/10] w-full rounded-card" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </Card>
  );
}

function ListingActions({
  listing,
  liveThreadId,
}: {
  listing: Doc<"listings">;
  liveThreadId: Id<"threads"> | null;
}) {
  const rescrape = useMutation(api.listings.rescrape);
  const archive = useMutation(api.listings.archive);
  const closeThread = useMutation(api.threads.close);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"refresh" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const working = listing.status === "queued" || listing.status === "scouting";

  async function onRefresh() {
    if (busy !== null) return;
    setBusy("refresh");
    try {
      await rescrape({ listingId: listing._id });
      toast.success(listing.isSample ? "Match refreshed against your profile." : "The Scout is reading the page again.");
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    if (busy !== null) return;
    setBusy("remove");
    try {
      // Archiving alone leaves the conversation open, so end it first.
      if (liveThreadId !== null) await closeThread({ threadId: liveThreadId });
      await archive({ listingId: listing._id });
      toast("Removed from your board.");
      navigate("/app");
    } catch (error) {
      toastError(error);
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 lg:shrink-0 lg:justify-end">
      {isWebUrl(listing.sourceUrl) && (
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-card px-3 text-sm font-medium text-ink transition-colors hover:border-forest hover:text-forest"
        >
          View on {hostOf(listing.sourceUrl) ?? "the original site"}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
      {!working && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          loading={busy === "refresh"}
          disabled={busy !== null}
          icon={<RefreshCw className="size-3.5" />}
        >
          {listing.isSample ? "Refresh match" : "Read it again"}
        </Button>
      )}
      {confirming ? (
        <span className="inline-flex animate-rise items-center gap-1.5">
          <span className="text-xs text-ink-soft">
            {liveThreadId !== null ? "This also closes the conversation." : "Remove this listing?"}
          </span>
          <Button size="sm" variant="danger" onClick={onRemove} loading={busy === "remove"}>
            Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy !== null}>
            Keep
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={busy !== null}>
          Remove from board
        </Button>
      )}
    </div>
  );
}

function ListingDetailView({ listingId }: { listingId: Id<"listings"> }) {
  const listing = useQuery(api.listings.get, { listingId });
  const conversation = useQuery(api.threads.forListing, { listingId });
  const renter = useQuery(api.renters.me);
  const status = useQuery(api.system.status);
  const rescrape = useMutation(api.listings.rescrape);
  const [retrying, setRetrying] = useState(false);

  const title = listing ? listingName(listing) : null;
  useEffect(() => {
    document.title = title ? `${title} · Nestor` : "Listing · Nestor";
  }, [title]);

  if (listing === undefined) return <DetailSkeleton />;
  if (listing === null) return <ListingMissing />;

  const working = listing.status === "queued" || listing.status === "scouting";
  const failed = listing.status === "failed";
  const thread = conversation?.thread ?? null;
  const threadLive = thread !== null && thread.stage !== "declined" && thread.stage !== "closed";
  const where = [listing.address, listing.neighborhood, listing.city].filter(Boolean).join(", ");
  const facts = [
    bedsBaths(listing.bedrooms, listing.bathrooms),
    listing.sqft !== undefined ? `${listing.sqft.toLocaleString("en-US")} sq ft` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  async function onRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await rescrape({ listingId });
    } catch (error) {
      toastError(error);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className={shell}>
      <BackLink />

      <header className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {listing.isSample && <Badge tone="honey">Sample listing</Badge>}
            {thread && (
              <span key={thread.stage} className="inline-flex animate-rise">
                <Badge tone={STAGE_TONE[thread.stage]} dot>
                  {STAGE_LABEL[thread.stage]}
                </Badge>
              </span>
            )}
            {working && (
              <Badge tone="sky" dot pulse>
                Scouting
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-3xl text-ink sm:text-4xl">{title}</h1>
          {where && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink-soft">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
              {where}
            </p>
          )}
          {!working && !failed && (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-3xl tabular-nums text-ink">
                {listing.rentMonthly !== undefined ? money(listing.rentMonthly) : "Rent not listed"}
              </span>
              {listing.rentMonthly !== undefined && <span className="text-sm text-ink-faint">a month</span>}
              {facts && <span className="text-sm text-ink-soft">{facts}</span>}
            </p>
          )}
        </div>
        <ListingActions listing={listing} liveThreadId={threadLive && thread ? thread._id : null} />
      </header>

      {failed && (
        <Callout
          tone="clay"
          className="mt-6"
          icon={<TriangleAlert className="size-4" />}
          title="The Scout could not read this listing"
        >
          <p>{listing.error ?? "Something went wrong while reading the page."}</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2.5"
            onClick={onRetry}
            loading={retrying}
            icon={<RefreshCw className="size-3.5" />}
          >
            Try again
          </Button>
        </Callout>
      )}

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
        <div className="order-2 min-w-0 space-y-5 lg:order-1">
          {working ? (
            <ScoutingState listing={listing} />
          ) : (
            !failed && (
              <div key={listing.scrapedAt ?? "facts"} className="animate-rise space-y-5">
                <PhotoGallery photos={listing.photos} alt={title ?? "Rental listing"} />
                <MatchPanel listing={listing} />
                <ListingFacts listing={listing} />
              </div>
            )
          )}
          {!working && !failed && <ContactBlock listing={listing} status={status} locked={thread !== null} />}
        </div>

        <div className="order-1 min-w-0 lg:sticky lg:top-6 lg:order-2 lg:max-h-[calc(100dvh-3rem)] lg:-mx-1.5 lg:overflow-y-auto lg:overscroll-contain lg:px-1.5 lg:pb-2">
          {conversation === undefined ? (
            <Skeleton className="h-80 w-full rounded-card" />
          ) : conversation === null ? (
            failed ? (
              <Card className="p-6 text-sm text-ink-soft">
                Once the Scout can read this listing, Nestor can write to the landlord about it.
              </Card>
            ) : (
              <StartNegotiation listing={listing} renter={renter} status={status} />
            )
          ) : (
            <Conversation
              thread={conversation.thread}
              messages={conversation.messages}
              tours={conversation.tours}
              status={status}
              autopilot={renter?.autopilot === true}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function ListingDetail() {
  const { listingId } = useParams();
  if (!listingId) return <ListingMissing />;
  return (
    <NotFoundBoundary key={listingId} fallback={<ListingMissing />}>
      <ListingDetailView listingId={listingId as Id<"listings">} />
    </NotFoundBoundary>
  );
}
