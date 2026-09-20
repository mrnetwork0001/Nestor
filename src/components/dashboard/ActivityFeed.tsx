import { useEffect, useRef, useState, type ReactNode } from "react";
import { Binoculars, CalendarCheck, FileSearch, House, Mail, PenLine, Radio } from "@/components/icons";
import { Link } from "react-router";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui";
import { useNow } from "@/components/listing/helpers";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";

type Activity = Doc<"activity">;

const KIND: Record<Activity["kind"], { label: string; icon: ReactNode; chip: string }> = {
  scout: { label: "Scout", icon: <Binoculars className="size-3.5" />, chip: "bg-sky-soft text-sky" },
  negotiator: { label: "Negotiator", icon: <PenLine className="size-3.5" />, chip: "bg-forest-soft text-forest" },
  landlord: { label: "Landlord", icon: <Mail className="size-3.5" />, chip: "bg-clay-soft text-clay-deep" },
  tour: { label: "Tour", icon: <CalendarCheck className="size-3.5" />, chip: "bg-forest-soft text-forest" },
  lease: { label: "Lease check", icon: <FileSearch className="size-3.5" />, chip: "bg-honey-soft text-honey" },
  system: { label: "Nestor", icon: <House className="size-3.5" />, chip: "bg-paper-deep text-ink-soft" },
};

const HIGHLIGHT_MS = 2600;

function FeedRow({ entry, live, now }: { entry: Activity; live: boolean; now: number }) {
  // Rows that arrive while the page is open glow for a moment, so the eye catches them.
  const [glow, setGlow] = useState(live);
  useEffect(() => {
    if (!live) return;
    const timer = window.setTimeout(() => setGlow(false), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [live]);

  const kind = KIND[entry.kind];
  const body = (
    <>
      <span
        className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", kind.chip)}
        aria-hidden="true"
      >
        {kind.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{kind.label}</span>
          <time
            dateTime={new Date(entry._creationTime).toISOString()}
            className="shrink-0 text-[11px] tabular-nums text-ink-faint"
          >
            {timeAgo(entry._creationTime, now)}
          </time>
        </span>
        <span className="mt-0.5 block text-sm font-medium leading-snug text-ink">{entry.title}</span>
        {entry.detail && (
          <span className="mt-0.5 line-clamp-3 block text-xs leading-relaxed text-ink-soft">{entry.detail}</span>
        )}
      </span>
    </>
  );

  const rowClass = cn(
    "flex animate-rise gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-1000",
    glow ? "bg-honey-soft" : "bg-transparent",
  );

  return (
    <li>
      {entry.listingId ? (
        <Link to={`/app/listings/${entry.listingId}`} className={cn(rowClass, !glow && "hover:bg-paper-deep")}>
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

/** Ids that were already there on first load. Anything else arrived live. */
function useInitialIds(feed: Activity[] | undefined): ReadonlySet<string> | null {
  const initial = useRef<ReadonlySet<string> | null>(null);
  if (initial.current === null && feed !== undefined) {
    initial.current = new Set(feed.map((entry) => entry._id));
  }
  return initial.current;
}

/** The live feed of what the agents are doing. One reactive query, newest first. */
export function ActivityFeed({ feed, className }: { feed: Activity[] | undefined; className?: string }) {
  const now = useNow();
  const initialIds = useInitialIds(feed);

  return (
    <section
      aria-label="Live activity"
      className={cn("flex min-h-0 flex-col rounded-card border border-line bg-card shadow-card", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Behind the scenes</p>
          <h2 className="text-xl text-ink">Live activity</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-forest/15 bg-forest-soft px-2.5 py-0.5 text-xs font-medium text-forest-deep">
          <Radio className="size-3 animate-pulse-dot" aria-hidden="true" />
          Live
        </span>
      </header>

      {feed === undefined ? (
        <div className="space-y-4 p-4" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : feed.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm leading-relaxed text-ink-soft">
          Nothing yet. Add a listing and every step the Scout and the Negotiator take will show up here as it
          happens.
        </p>
      ) : (
        <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5" aria-live="polite">
          {feed.map((entry) => (
            <FeedRow key={entry._id} entry={entry} now={now} live={initialIds !== null && !initialIds.has(entry._id)} />
          ))}
        </ol>
      )}
    </section>
  );
}

/** One-line version of the feed for narrow screens, where the full feed sits below the board. */
export function LatestActivity({ feed, className }: { feed: Activity[] | undefined; className?: string }) {
  const now = useNow();
  const latest = feed?.[0];
  if (latest === undefined) return null;
  const kind = KIND[latest.kind];

  return (
    <a
      href="#activity"
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2 text-sm shadow-card",
        className,
      )}
    >
      <span
        className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", kind.chip)}
        aria-hidden="true"
      >
        {kind.icon}
      </span>
      <span key={latest._id} className="min-w-0 flex-1 animate-rise truncate text-ink">
        <span className="sr-only">Latest activity: </span>
        {latest.title}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-ink-faint">{timeAgo(latest._creationTime, now)}</span>
    </a>
  );
}
