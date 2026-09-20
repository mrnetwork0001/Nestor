import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { BellRing, CalendarCheck, Home, MailCheck, PiggyBank, Send } from "@/components/icons";
import type { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";

type Summary = FunctionReturnType<typeof api.dashboard.summary>;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function needsYouDetail(breakdown: Summary["needsYouBreakdown"]): string {
  const parts: string[] = [];
  if (breakdown.drafts > 0) parts.push(plural(breakdown.drafts, "draft to approve", "drafts to approve"));
  if (breakdown.questions > 0) parts.push(plural(breakdown.questions, "question", "questions"));
  if (breakdown.tours > 0) parts.push(plural(breakdown.tours, "tour time to pick", "tour times to pick"));
  return parts.length > 0 ? parts.join(", ") : "Nothing is waiting on you";
}

function Tile({
  icon,
  label,
  value,
  detail,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-card border px-4 py-3 shadow-card transition-colors duration-500 xl:px-3.5 2xl:px-4",
        highlight ? "border-honey/40 bg-honey-soft" : "border-line bg-card",
      )}
    >
      <div className="flex items-center gap-2 text-ink-faint">
        <span className={cn("shrink-0 xl:hidden 2xl:inline", highlight ? "text-honey" : "text-moss")}>{icon}</span>
        <p className="truncate text-xs font-semibold uppercase tracking-[0.1em]">{label}</p>
      </div>
      {/* Keyed on the value, so a number that changes live rises into place instead of just swapping. */}
      <p key={value} className="mt-1 animate-rise font-display text-3xl tabular-nums text-ink">
        {value}
      </p>
      {/* Beside the activity feed the tiles sit six across and get narrow, so the caption steps aside there. */}
      <p className="mt-0.5 text-xs leading-snug text-ink-soft xl:sr-only 2xl:not-sr-only">{detail}</p>
    </div>
  );
}

/** The numbers at the top of the dashboard. They come from one reactive query, so they tick as the agents work. */
export function StatRow({ summary }: { summary: Summary | undefined }) {
  if (summary === undefined) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[6.25rem] rounded-card xl:h-[4.75rem] 2xl:h-[6.25rem]" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Your search at a glance" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile
        icon={<Home className="size-4" />}
        label="Listings"
        value={String(summary.listings)}
        detail="on your board"
      />
      <Tile
        icon={<Send className="size-4" />}
        label="Inquiries"
        value={String(summary.inquiriesSent)}
        detail={summary.inquiriesSent === 1 ? "landlord emailed" : "landlords emailed"}
      />
      <Tile
        icon={<MailCheck className="size-4" />}
        label="Replies"
        value={String(summary.replies)}
        detail="read and parsed for you"
      />
      <Tile
        icon={<CalendarCheck className="size-4" />}
        label="Tours"
        value={String(summary.toursBooked)}
        detail="booked"
      />
      <Tile
        icon={<PiggyBank className="size-4" />}
        label="Saved"
        value={money(summary.monthlySavings)}
        detail="a month off asking rent, so far"
      />
      <Tile
        icon={<BellRing className="size-4" />}
        label="Needs you"
        value={String(summary.needsYou)}
        detail={needsYouDetail(summary.needsYouBreakdown)}
        highlight={summary.needsYou > 0}
      />
    </section>
  );
}
