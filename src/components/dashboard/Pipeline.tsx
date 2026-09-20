import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "@/components/icons";
import type { ListingRow } from "@/components/listing/helpers";
import { cn } from "@/lib/cn";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/format";
import { ListingCard } from "./ListingCard";

type ColumnKey = "new" | (typeof STAGE_ORDER)[number];

const COLUMNS: Array<{ key: ColumnKey; label: string; hint: string; bar: string }> = [
  { key: "new", label: "New", hint: "Scouted, no conversation yet", bar: "bg-line-strong" },
  {
    key: "needs_approval",
    label: STAGE_LABEL.needs_approval,
    hint: "Nestor is writing, or has an email ready for you",
    bar: "bg-honey",
  },
  { key: "awaiting_reply", label: STAGE_LABEL.awaiting_reply, hint: "Sent, nothing back yet", bar: "bg-sky" },
  { key: "negotiating", label: STAGE_LABEL.negotiating, hint: "The landlord replied", bar: "bg-clay" },
  { key: "tour_scheduled", label: STAGE_LABEL.tour_scheduled, hint: "A time is confirmed", bar: "bg-forest" },
  { key: "terms_agreed", label: STAGE_LABEL.terms_agreed, hint: "Ready for the lease check", bar: "bg-forest-deep" },
];

const MOVED_HIGHLIGHT_MS = 3200;

/** Which column a listing sits in, or null for conversations that are over. */
function columnOf(listing: ListingRow): ColumnKey | null {
  const stage = listing.thread?.stage;
  if (stage === undefined) return "new";
  if (stage === "declined" || stage === "closed") return null;
  // While the Negotiator writes, the card waits where its draft will land.
  if (stage === "drafting") return "needs_approval";
  return stage;
}

/**
 * The board: listings grouped by where their conversation stands. Every card
 * is keyed by listing id inside its column, so when a stage changes the card
 * unmounts from one column and rises into the next, ringed for a moment.
 */
export function Pipeline({ listings }: { listings: ListingRow[] }) {
  const { columns, closed } = useMemo(() => {
    const grouped = new Map<ColumnKey, ListingRow[]>(COLUMNS.map((c) => [c.key, []]));
    const over: ListingRow[] = [];
    for (const listing of listings) {
      const key = columnOf(listing);
      if (key === null) over.push(listing);
      else grouped.get(key)?.push(listing);
    }
    return { columns: grouped, closed: over };
  }, [listings]);

  const [moved, setMoved] = useState<ReadonlySet<string>>(() => new Set<string>());
  const previous = useRef<Map<string, ColumnKey | null> | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const current = new Map<string, ColumnKey | null>(listings.map((l) => [l._id, columnOf(l)]));

    const before = previous.current;
    previous.current = current;
    if (before === null) return;
    const changed = [...current].filter(([id, key]) => before.has(id) && before.get(id) !== key).map(([id]) => id);
    if (changed.length === 0) return;

    setMoved((ids) => new Set([...ids, ...changed]));
    const timer = window.setTimeout(() => {
      setMoved((ids) => new Set([...ids].filter((id) => !changed.includes(id))));
    }, MOVED_HIGHLIGHT_MS);
    timers.current.push(timer);
  }, [listings]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const [showClosed, setShowClosed] = useState(false);

  return (
    <div>
      <div className="-mx-1 flex flex-col gap-3 px-1 pb-2 md:flex-row md:overflow-x-auto">
        {COLUMNS.map((column) => {
          const cards = columns.get(column.key) ?? [];

          // An empty stage folds down to a slim rail, so the columns that hold cards get the width.
          if (cards.length === 0) {
            return (
              <section
                key={column.key}
                aria-label={`${column.label}: empty`}
                title={column.hint}
                className="flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-line bg-paper-deep/40 px-3.5 py-2.5 md:w-11 md:flex-col md:px-0 md:py-3.5"
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", column.bar)} aria-hidden="true" />
                <h3 className="font-sans text-xs font-semibold tracking-wide text-ink-faint md:[writing-mode:vertical-rl]">
                  {column.label}
                </h3>
                <span className="ml-auto text-xs tabular-nums text-ink-faint md:ml-0 md:mt-auto">0</span>
              </section>
            );
          }

          return (
            <section
              key={column.key}
              aria-label={`${column.label}: ${cards.length}`}
              className={cn(
                "flex min-w-0 animate-rise flex-col rounded-2xl border border-line bg-paper-deep/50 md:min-w-[10.5rem] md:basis-0",
                // Most listings wait in "New", so it gets the larger share of the board.
                column.key === "new" ? "md:flex-[1.5]" : "md:flex-1",
              )}
            >
              <header className="px-3.5 pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-3.5 w-1 shrink-0 rounded-full", column.bar)} aria-hidden="true" />
                  <h3 className="font-sans text-sm font-semibold text-ink">{column.label}</h3>
                  <span
                    key={cards.length}
                    className="ml-auto inline-flex min-w-6 animate-rise justify-center rounded-full bg-card px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink-soft"
                  >
                    {cards.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">{column.hint}</p>
              </header>
              <div className="@container px-2.5 pb-2.5">
                <div className="grid grid-cols-1 gap-2.5 @[34rem]:grid-cols-2 @[52rem]:grid-cols-3">
                  {cards.map((listing) => (
                    <div key={listing._id} className="@container min-w-0">
                      <ListingCard listing={listing} moved={moved.has(listing._id)} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {closed.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowClosed((value) => !value)}
            aria-expanded={showClosed}
            aria-controls="pipeline-closed"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <ChevronDown
              className={cn("size-4 transition-transform", showClosed ? "rotate-0" : "-rotate-90")}
              aria-hidden="true"
            />
            Closed and declined
            <span className="rounded-full bg-paper-deep px-1.5 py-0.5 text-xs tabular-nums">{closed.length}</span>
          </button>
          {showClosed && (
            <div id="pipeline-closed" className="mt-2 grid gap-2.5 opacity-80 sm:grid-cols-2 2xl:grid-cols-3">
              {closed.map((listing) => (
                <div key={listing._id} className="@container min-w-0">
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
