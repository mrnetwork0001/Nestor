import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FlaskConical, House } from "@/components/icons";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { ActivityFeed, LatestActivity } from "@/components/dashboard/ActivityFeed";
import { AddListingBar } from "@/components/dashboard/AddListingBar";
import { NeedsYou } from "@/components/dashboard/NeedsYou";
import { Pipeline } from "@/components/dashboard/Pipeline";
import { StatRow } from "@/components/dashboard/StatRow";
import { firstName, toastError, useNow } from "@/components/listing/helpers";
import { Button, EmptyState, PageHeader, SectionHeading, Skeleton } from "@/components/ui";

function greeting(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:flex-row" aria-busy="true" aria-label="Loading your listings">
      {Array.from({ length: 3 }, (_, column) => (
        <div key={column} className="flex-1 space-y-2.5 rounded-2xl border border-line bg-paper-deep/50 p-2.5">
          <Skeleton className="mx-1 mt-1.5 h-4 w-24" />
          {Array.from({ length: 2 - (column % 2) }, (_, card) => (
            <Skeleton key={card} className="h-44 rounded-2xl bg-card" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const renter = useQuery(api.renters.me);
  const summary = useQuery(api.dashboard.summary);
  const listings = useQuery(api.listings.list);
  const feed = useQuery(api.activity.feed, { limit: 40 });
  const threads = useQuery(api.threads.list);
  const tours = useQuery(api.tours.list);
  const status = useQuery(api.system.status);
  const loadSamples = useMutation(api.listings.loadSamples);

  const now = useNow(30_000);
  const [loadingSamples, setLoadingSamples] = useState(false);

  useEffect(() => {
    document.title = "Dashboard · Nestor";
  }, []);

  const knownListingIds = useMemo(() => new Set<string>((listings ?? []).map((l) => l._id)), [listings]);
  const hasSamples = (listings ?? []).some((l) => l.isSample);
  const scouting = (listings ?? []).filter((l) => l.status === "queued" || l.status === "scouting").length;

  async function onLoadSamples() {
    if (loadingSamples) return;
    setLoadingSamples(true);
    try {
      const added = await loadSamples({});
      if (added === 0) toast("The sample listings are already on your board.");
    } catch (error) {
      toastError(error);
    } finally {
      setLoadingSamples(false);
    }
  }

  const needsYou = summary?.needsYou ?? 0;
  const lead =
    summary === undefined
      ? "Checking in with your agents."
      : needsYou > 0
        ? `${needsYou === 1 ? "One thing is" : `${needsYou} things are`} waiting on you. Everything else is in hand.`
        : summary.listings === 0
          ? "Add a listing and Nestor will read it, score it against what you want, and write to the landlord for you."
          : scouting > 0
            ? "The Scout is reading. Cards fill in on their own as it finishes."
            : "Nothing needs you right now. Nestor is keeping watch.";

  return (
    <div className="mx-auto w-full max-w-[92rem] px-5 py-8 sm:px-8 lg:py-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-7">
        <div className="min-w-0 space-y-6">
          <PageHeader
            eyebrow={renter?.city ? `Your search in ${renter.city}` : "Your search"}
            title={`${greeting(new Date(now).getHours())}${renter ? `, ${firstName(renter.displayName, "there")}` : ""}`}
            lede={lead}
          />

          <NeedsYou threads={threads} tours={tours} now={now} />
          <StatRow summary={summary} />
          <AddListingBar
            status={status}
            city={renter?.city}
            knownListingIds={knownListingIds}
            hasSamples={hasSamples}
          />
          <LatestActivity feed={feed} className="xl:hidden" />

          <section aria-labelledby="pipeline-heading" className="space-y-3.5">
            <SectionHeading
              eyebrow="Pipeline"
              title={<span id="pipeline-heading">Where every home stands</span>}
            />
            {listings === undefined ? (
              <BoardSkeleton />
            ) : listings.length === 0 ? (
              <EmptyState
                icon={<House className="size-5" />}
                title="Your board is empty"
                body="Paste a listing link above, or load six sample homes with a demo landlord to see the whole flow in two minutes: scouting, the first email, the reply, and a booked tour."
                action={
                  <Button
                    onClick={onLoadSamples}
                    loading={loadingSamples}
                    icon={<FlaskConical className="size-4" />}
                  >
                    Load sample listings
                  </Button>
                }
              />
            ) : (
              <Pipeline listings={listings} />
            )}
          </section>
        </div>

        <aside id="activity" className="min-w-0 scroll-mt-6 xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)]">
          <ActivityFeed feed={feed} className="max-h-[32rem] xl:h-full xl:max-h-none" />
        </aside>
      </div>
    </div>
  );
}
