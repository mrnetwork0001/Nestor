import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  FileSearch,
  House,
  Link2,
  PawPrint,
  PenLine,
  TriangleAlert,
} from "@/components/icons";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { linkButtonClass } from "./linkButtonClass";
import { SAMPLE_FLAG, STORY, STORY_FEED, type FeedKind } from "./story";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/*
 * Pieces of Nestor's real interface, filled with the landing page's story and
 * made inert. Each one is exposed to assistive tech as a single described
 * image, so nothing inside is focusable and the controls are drawn, not live.
 */

/** Wraps a fragment so screen readers get one sentence instead of fake controls. */
export function Depiction({
  label,
  className,
  style,
  children,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div role="img" aria-label={label} className={className} style={style}>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function FauxButton({
  variant,
  children,
}: {
  variant: "primary" | "secondary" | "ghost";
  children: ReactNode;
}) {
  return <span className={linkButtonClass(variant, "sm", "cursor-default")}>{children}</span>;
}

const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

// Match score ------------------------------------------------------------------

export function MatchRing({ score, className }: { score: number; className?: string }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className={cn("relative inline-flex size-12 shrink-0 items-center justify-center", className)}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" fill="none">
        <circle cx="20" cy="20" r={radius} strokeWidth="3" className="stroke-forest-soft" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * score) / 100} ${circumference}`}
          className="stroke-forest"
        />
      </svg>
      <span className="text-sm font-semibold tabular-nums text-forest-deep">{score}</span>
    </span>
  );
}

// Listing card -----------------------------------------------------------------

function ListingPhoto() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex h-32 items-center justify-center overflow-hidden bg-paper-deep paper-grain">
      <House className="size-8 text-line-strong" />
      {!failed && (
        <img
          src={STORY.listing.photo}
          alt=""
          width={640}
          height={427}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <span className="absolute left-3 top-3">
        <Badge tone="clay" dot pulse>
          Negotiating
        </Badge>
      </span>
    </div>
  );
}

export function ListingFragment({
  tucked = false,
  className,
  style,
}: {
  /** Another card overlaps the bottom edge, so leave it room. */
  tucked?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { listing } = STORY;
  return (
    <Depiction
      label={`A listing card: ${listing.title}, ${listing.place}, ${money(listing.rentAsked)} a month, match score ${listing.matchScore} out of 100.`}
      className={cn("overflow-hidden rounded-card border border-line bg-card shadow-lift", className)}
      style={style}
    >
      <ListingPhoto />
      <div className={cn("p-4", tucked && "sm:pb-9")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg leading-snug text-ink">{listing.title}</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {listing.place} · {listing.facts}
            </p>
          </div>
          <MatchRing score={listing.matchScore} />
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          <span className="text-base font-semibold text-ink">{money(listing.rentAsked)}</span>/mo
        </p>
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs text-ink-soft">
          <li className="flex items-center gap-2">
            <Check className="size-3.5 shrink-0 text-forest" />
            $150 under your monthly budget
          </li>
          <li className="flex items-center gap-2">
            <PawPrint className="size-3.5 shrink-0 text-forest" />
            Dogs welcome, in-unit laundry
          </li>
          <li className="flex items-center gap-2">
            <TriangleAlert className="size-3.5 shrink-0 text-honey" />
            $350 pet fee: worth negotiating
          </li>
        </ul>
      </div>
    </Depiction>
  );
}

// Negotiator draft -------------------------------------------------------------

export function DraftFragment({
  compact = false,
  className,
  style,
}: {
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { renter, landlord } = STORY;
  return (
    <Depiction
      label={`A draft email from Nestor to ${landlord.name}. It opens by saying it is written by an AI assistant on behalf of ${renter.first}, asks to waive the pet fee, explains why, and waits for ${renter.first}'s approval.`}
      className={cn("@container rounded-card border border-line bg-card shadow-lift", className)}
      style={style}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <PenLine className="size-4 shrink-0 text-forest" />
          {/* A narrow card keeps the whole word rather than an ellipsis. */}
          <span className="truncate">
            Draft<span className="hidden @[17rem]:inline"> inquiry</span>
          </span>
        </span>
        <Badge tone="honey" dot className="shrink-0 whitespace-nowrap">
          Needs your OK
        </Badge>
      </div>
      <div className="space-y-2 px-4 py-3">
        <p className="truncate text-xs text-ink-faint">
          To <span className="text-ink-soft">{landlord.name}</span>
          <span className="mx-1.5">·</span>
          <span className="text-ink-soft">1-bed at Maple Court: availability and a tour</span>
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Hi {landlord.first},{" "}
          <span className="rounded bg-honey-soft px-1 py-0.5 text-ink">
            I'm Nestor, an AI assistant writing on behalf of {renter.first}, who reads this
            conversation and makes every decision.
          </span>{" "}
          {renter.first} and her beagle would love to see Unit 3B. Would you consider waiving the
          $350 pet fee on a 12-month lease?
        </p>
      </div>
      {!compact && (
        <div className="mx-4 mb-3 rounded-xl bg-forest-soft px-3 py-2.5 text-xs leading-relaxed text-forest-deep">
          <p className="font-semibold">Why this ask</p>
          <p className="mt-0.5">
            The listing charges a $350 pet fee on top of $35 monthly pet rent. One clear ask, backed
            by a fact from the page.
          </p>
        </div>
      )}
      <div className="@container border-t border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <FauxButton variant="primary">Approve &amp; send</FauxButton>
          <FauxButton variant="secondary">Rewrite</FauxButton>
          <span className="hidden @[18rem]:inline-flex">
            <FauxButton variant="ghost">Discard</FauxButton>
          </span>
        </div>
      </div>
    </Depiction>
  );
}

// Landlord reply, parsed -------------------------------------------------------

export function ParsedChips({ startAt = 0 }: { startAt?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="animate-rise" style={delay(startAt)}>
        <Badge tone="forest">
          <CalendarDays className="size-3" />
          Tour · Sat 11:00 AM
        </Badge>
      </span>
      <span className="animate-rise" style={delay(startAt + 0.15)}>
        <Badge tone="clay">$50 off rent</Badge>
      </span>
      <span className="animate-rise" style={delay(startAt + 0.3)}>
        <Badge tone="clay">Pet fee waived</Badge>
      </span>
    </div>
  );
}

export function ReplyFragment({
  chipsAt = 0,
  className,
  style,
}: {
  chipsAt?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { landlord, listing } = STORY;
  return (
    <Depiction
      label={`A reply from ${landlord.name}, read by Nestor into a tour on Saturday at 11 AM, 50 dollars off the rent and a waived pet fee. Rent moves from ${money(listing.rentAsked)} to ${money(listing.rentAgreed)} a month.`}
      className={cn("rounded-card border border-line bg-card shadow-lift", className)}
      style={style}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-clay-soft text-xs font-semibold text-clay-deep">
          {landlord.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{landlord.name}</p>
          <p className="text-xs text-ink-faint">Replied 4 minutes ago</p>
        </div>
      </div>
      <p className="px-4 pt-3 text-sm leading-relaxed text-ink-soft">
        "Thanks for sending {STORY.renter.first}'s profile, that makes my job easier. I can take $50
        off on a 12-month lease and waive the pet fee. Saturday at 11 works for a tour."
      </p>
      <div className="px-4 pb-4 pt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Nestor read this as
        </p>
        <ParsedChips startAt={chipsAt} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-paper-deep/40 px-4 py-2.5 text-sm">
        <span className="text-ink-faint">Rent</span>
        <span className="flex items-center gap-2 tabular-nums">
          <span className="text-ink-faint line-through">{money(listing.rentAsked)}</span>
          <ArrowRight className="size-3.5 text-ink-faint" />
          <span className="font-semibold text-forest-deep">{money(listing.rentAgreed)}/mo</span>
        </span>
      </div>
    </Depiction>
  );
}

// Activity feed ----------------------------------------------------------------

const KIND_DOT: Record<FeedKind, string> = {
  scout: "bg-sky",
  negotiator: "bg-forest",
  landlord: "bg-clay",
  tour: "bg-forest",
  lease: "bg-honey",
  system: "bg-ink-faint",
};

const KIND_LABEL: Record<FeedKind, string> = {
  scout: "Scout",
  negotiator: "Negotiator",
  landlord: "Landlord",
  tour: "Tours",
  lease: "Lease check",
  system: "You",
};

const FEED_AGES = ["just now", "9s ago", "24s ago", "1m ago", "2m ago", "3m ago"];
const FEED_ROW_REM = 4.25;

/**
 * The hero's ticking feed. Every few seconds the next line of the story rises
 * in at the top and the rest slide down one row. With reduced motion it is a
 * still list of the story's best moment.
 */
export function FeedFragment({
  rows = 4,
  className,
  style,
}: {
  rows?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2600);
    return () => window.clearInterval(id);
  }, [reduced]);

  const total = STORY_FEED.length;
  const newest = reduced ? total - 2 : tick + rows - 1;
  // One extra row so the oldest line slides out under the clip instead of vanishing.
  const items = Array.from({ length: rows + 1 }, (_, i) => {
    const index = newest - i;
    return { index, ...STORY_FEED[((index % total) + total) % total] };
  });

  return (
    <Depiction
      label="Nestor's live activity feed: the Scout finds and scores a listing, the Negotiator drafts an email, the landlord offers tour times and a lower rent, and a tour is booked."
      className={cn("rounded-card border border-line bg-card shadow-lift", className)}
      style={style}
    >
      <style>{`@keyframes nestor-feed-shift{from{transform:translateY(-${FEED_ROW_REM}rem)}to{transform:translateY(0)}}`}</style>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-ink">Activity</span>
        <Badge tone="forest" dot pulse>
          Live
        </Badge>
      </div>
      <div className="overflow-hidden" style={{ height: `${rows * FEED_ROW_REM}rem` }}>
        <ol
          key={tick}
          style={
            tick > 0
              ? { animation: "nestor-feed-shift 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both" }
              : undefined
          }
        >
          {items.map((item, i) => (
            <li
              key={item.index}
              className={cn(
                "flex items-start gap-2.5 border-b border-line px-4 py-2.5",
                i === 0 && tick > 0 && "animate-rise",
              )}
              style={{ height: `${FEED_ROW_REM}rem` }}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT[item.kind])} />
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13px] leading-snug text-ink">{item.title}</span>
                <span className="block text-[11px] text-ink-faint">
                  {KIND_LABEL[item.kind]} · {FEED_AGES[i] ?? FEED_AGES[FEED_AGES.length - 1]}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Depiction>
  );
}

// Step fragments ---------------------------------------------------------------

export function UrlBarFragment({ className }: { className?: string }) {
  const { listing } = STORY;
  return (
    <Depiction
      label="A box to paste a listing link, and the facts the Scout read from the page: rent, bedrooms, pet fee, move-in date and a match score of 92."
      className={cn("rounded-card border border-line bg-card p-4 shadow-card", className)}
    >
      <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-paper px-3 py-2">
        <Link2 className="size-4 shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
          zumper.com/apartments-for-rent/chicago-il/maple-court-3b
        </span>
        <FauxButton variant="primary">Read listing</FauxButton>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="sky">{money(listing.rentAsked)}/mo</Badge>
          <Badge>1 bd · 1 ba</Badge>
          <Badge>Available Oct 1</Badge>
          <Badge tone="honey">Pet fee $350</Badge>
        </div>
        <MatchRing score={listing.matchScore} />
      </div>
    </Depiction>
  );
}

export function TourChoiceFragment({ className }: { className?: string }) {
  return (
    <Depiction
      label="The landlord's reply turned into two tour times to choose from, with the offers Nestor found in the email."
      className={cn("rounded-card border border-line bg-card p-4 shadow-card", className)}
    >
      <ParsedChips />
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {STORY.tours.map((slot, i) => (
          <li key={slot} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <CalendarDays className="size-4 shrink-0 text-moss" />
              <span className="truncate">{slot}</span>
            </span>
            <FauxButton variant={i === 0 ? "primary" : "secondary"}>Choose</FauxButton>
          </li>
        ))}
      </ul>
    </Depiction>
  );
}

export function FeeTableFragment({ className }: { className?: string }) {
  return (
    <Depiction
      label="The fees the Scout read from the listing: a 75 dollar application fee, a 350 dollar pet fee and 35 dollars a month pet rent. Below, a leasing office email the Scout found, shown with the page it was published on."
      className={cn("rounded-card border border-line bg-card shadow-card", className)}
    >
      <p className="border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Fees on the page
      </p>
      <ul className="divide-y divide-line px-4 text-sm">
        {STORY.listing.fees.map((fee) => (
          <li key={fee.label} className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-ink-soft">{fee.label}</span>
            <span className="tabular-nums text-ink">
              {fee.amount} <span className="text-xs text-ink-faint">{fee.cadence}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-line bg-paper-deep/40 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Leasing office email, found by the Scout
        </p>
        <p className="mt-1 truncate text-sm text-ink">leasing@maplecourt.example</p>
        <p className="truncate text-xs text-ink-faint">Published on maplecourt.example/contact</p>
      </div>
    </Depiction>
  );
}

export function RewriteFragment({ className }: { className?: string }) {
  return (
    <Depiction
      label="A box where the renter tells the Negotiator how to rewrite the draft, in one sentence."
      className={cn("rounded-card border border-line bg-card p-4 shadow-card", className)}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Rewrite with an instruction
      </p>
      <p className="mt-2 rounded-xl border border-line-strong bg-paper px-3 py-2 text-sm leading-relaxed text-ink-soft">
        Warmer, and mention I can move in a week early if that helps.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <FauxButton variant="secondary">Rewrite draft</FauxButton>
        <span className="text-xs text-ink-faint">The ask and the facts stay yours.</span>
      </div>
    </Depiction>
  );
}

const PIPELINE: ReadonlyArray<{
  stage: string;
  tone: "honey" | "sky" | "forest";
  cards: ReadonlyArray<{ title: string; rent: string; live?: boolean }>;
  wideOnly?: boolean;
}> = [
  {
    stage: "Needs your OK",
    tone: "honey",
    cards: [{ title: "The Alder", rent: "$2,250" }],
    wideOnly: true,
  },
  {
    stage: "Awaiting reply",
    tone: "sky",
    cards: [
      { title: "Linden Row", rent: "$1,875" },
      { title: "Garden flat", rent: "$1,790" },
    ],
  },
  {
    stage: "Tour booked",
    tone: "forest",
    cards: [{ title: "Maple Court", rent: "$1,900", live: true }],
  },
];

const STATS: ReadonlyArray<{ label: string; value: string; accent?: boolean }> = [
  { label: "Replies", value: "3" },
  { label: "Tours booked", value: "1" },
  { label: "Negotiated so far", value: "$50/mo", accent: true },
];

export function PipelineFragment({ className }: { className?: string }) {
  return (
    <Depiction
      label="The dashboard: counts of replies, tours and savings, a note that one draft needs an OK, and listings grouped by stage from awaiting reply to tour booked."
      className={cn("@container rounded-card border border-line bg-paper p-3 shadow-card", className)}
    >
      <div className="grid grid-cols-3 gap-2">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-card px-3 py-2">
            <p
              className={cn(
                "font-display text-xl leading-tight tabular-nums",
                stat.accent ? "text-forest" : "text-ink",
              )}
            >
              {stat.value}
            </p>
            <p className="truncate text-[11px] text-ink-faint">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-2 rounded-xl border border-honey/25 bg-honey-soft px-3 py-2 text-xs text-honey">
        <span className="size-1.5 shrink-0 animate-pulse-dot rounded-full bg-current" />
        One draft is waiting for your OK
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 @[30rem]:grid-cols-3">
        {PIPELINE.map((column) => (
          <div key={column.stage} className={cn("min-w-0", column.wideOnly && "hidden @[30rem]:block")}>
            <Badge tone={column.tone} dot className="whitespace-nowrap">
              {column.stage}
            </Badge>
            <div className="mt-2 space-y-2">
              {column.cards.map((card) => (
                <div
                  key={card.title}
                  className={cn(
                    "rounded-xl border border-line bg-card px-3 py-2",
                    card.live && "animate-rise",
                  )}
                  style={card.live ? delay(0.4) : undefined}
                >
                  <p className="truncate text-[13px] font-medium text-ink">{card.title}</p>
                  <p className="text-xs tabular-nums text-ink-faint">{card.rent}/mo</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-card">
        {STORY_FEED.slice(4, 7)
          .reverse()
          .map((item, i) => (
            <li key={item.title} className="flex items-start gap-2.5 px-3 py-2">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT[item.kind])} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-snug text-ink">{item.title}</span>
                <span className="block text-[11px] text-ink-faint">
                  {KIND_LABEL[item.kind]} · {FEED_AGES[i + 1]}
                </span>
              </span>
            </li>
          ))}
      </ul>
    </Depiction>
  );
}

// Lease flag -------------------------------------------------------------------

export function LeaseFlagFragment({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Depiction
      label={`A lease check result. High severity, ${SAMPLE_FLAG.category}: ${SAMPLE_FLAG.title}. It quotes the clause, explains why it matters and suggests what to ask for.`}
      className={cn("rounded-card border border-line bg-card shadow-card", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <FileSearch className="size-4 shrink-0 text-forest" />
          <span className="truncate">Sample lease</span>
        </span>
        <Badge tone="clay">High risk</Badge>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="clay">High</Badge>
          <Badge>{SAMPLE_FLAG.category}</Badge>
          <span className="text-xs text-ink-faint">{SAMPLE_FLAG.section}</span>
        </div>
        <p className="font-display text-lg leading-snug text-ink">{SAMPLE_FLAG.title}</p>
        <blockquote className="border-l-2 border-clay pl-3 font-display text-[15px] italic leading-relaxed text-ink-soft">
          "{SAMPLE_FLAG.clause}"
        </blockquote>
        {!compact && <p className="text-sm leading-relaxed text-ink-soft">{SAMPLE_FLAG.why}</p>}
        <div className="rounded-xl bg-forest-soft px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-deep">
              What to ask for
            </p>
            <span className="flex items-center gap-1 text-xs text-forest-deep">
              <Copy className="size-3" />
              Copy
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-forest-deep">{SAMPLE_FLAG.ask}</p>
        </div>
      </div>
    </Depiction>
  );
}
