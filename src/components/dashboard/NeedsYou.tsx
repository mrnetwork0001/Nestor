import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, MessageCircleQuestionMark, PenLine } from "lucide-react";
import { Link } from "react-router";
import { firstName, type ThreadRow, type TourRow } from "@/components/listing/helpers";
import { cn } from "@/lib/cn";

type Item = { key: string; to: string; icon: ReactNode; title: string; detail: string };

const MAX_ITEMS = 5;

function buildItems(threads: ThreadRow[], tours: TourRow[], now: number): Item[] {
  const items: Item[] = [];
  const live = threads.filter((t) => t.stage !== "declined" && t.stage !== "closed" && t.listing !== null);

  for (const thread of live) {
    const listing = thread.listing;
    if (listing === null) continue;
    const who = firstName(thread.landlordName, "the landlord");
    const to = `/app/listings/${listing._id}`;

    if (thread.pendingDraft && thread.stage === "needs_approval") {
      items.push({
        key: `draft:${thread._id}`,
        to,
        icon: <PenLine className="size-4" />,
        title: `Approve the email to ${who}`,
        detail: listing.title,
      });
    }
    if (thread.openQuestions.length > 0) {
      items.push({
        key: `question:${thread._id}`,
        to,
        icon: <MessageCircleQuestionMark className="size-4" />,
        title: `${firstName(thread.landlordName, "The landlord")} asked: ${thread.openQuestions[0]}`,
        detail: listing.title,
      });
    }
    const slots = tours.filter((t) => t.threadId === thread._id && t.status === "proposed" && t.startsAt > now);
    if (slots.length > 0) {
      items.push({
        key: `tour:${thread._id}`,
        to,
        icon: <CalendarClock className="size-4" />,
        title: `Pick a tour time: ${slots.map((s) => s.label).join(" or ")}`,
        detail: listing.title,
      });
    }
  }
  return items;
}

/** The short list of things only the renter can do, each one click away from the conversation. */
export function NeedsYou({
  threads,
  tours,
  now,
}: {
  threads: ThreadRow[] | undefined;
  tours: TourRow[] | undefined;
  now: number;
}) {
  if (threads === undefined || tours === undefined) return null;
  const items = buildItems(threads, tours, now);
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_ITEMS);

  return (
    <section
      aria-label="Waiting on you"
      className="animate-rise rounded-card border border-honey/30 bg-honey-soft/70 p-2"
    >
      <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-honey">
        Waiting on you
      </p>
      <ul className={cn("grid gap-1", shown.length > 1 && "lg:grid-cols-2")}>
        {shown.map((item) => (
          <li key={item.key} className="animate-rise">
            <Link
              to={item.to}
              className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-card"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-honey"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                <span className="block truncate text-xs text-ink-soft">{item.detail}</span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-forest"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
      {items.length > shown.length && (
        <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-soft">
          And {items.length - shown.length} more on the board below.
        </p>
      )}
    </section>
  );
}
