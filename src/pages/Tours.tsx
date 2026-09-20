import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, CalendarDays, CalendarPlus, MapPin } from "@/components/icons";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge, Button, Callout, Card, EmptyState, PageHeader, Skeleton, type Tone } from "@/components/ui";
import { errorSentence } from "@/lib/errors";
import { cn } from "@/lib/cn";

type TourRow = FunctionReturnType<typeof api.tours.list>[number];
type ThreadRow = FunctionReturnType<typeof api.threads.list>[number];

const TOUR_LENGTH_MS = 30 * 60 * 1000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAY_PATTERNS = [
  /\bsun(day)?\b/,
  /\bmon(day)?\b/,
  /\btue(s|sday)?\b/,
  /\bwed(nesday)?\b/,
  /\bthu(r|rs|rsday)?\b/,
  /\bfri(day)?\b/,
  /\bsat(urday)?\b/,
];

/*
 * `startsAt` is an instant, but the day a renter cares about is the day on the
 * landlord's calendar, and this browser may sit in another time zone. The
 * label carries the landlord's words, so when the two disagree by a day the
 * label's date or weekday wins.
 */
function tourDay(tour: Pick<TourRow, "startsAt" | "label">): Date {
  const base = new Date(tour.startsAt);
  const label = tour.label.toLowerCase();
  const dated = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/.exec(label);
  const weekday = WEEKDAY_PATTERNS.findIndex((pattern) => pattern.test(label));
  for (const shift of [0, -1, 1]) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + shift);
    if (dated) {
      if (MONTHS[day.getMonth()] === dated[1] && day.getDate() === Number(dated[2])) return day;
    } else if (weekday >= 0 && day.getDay() === weekday) {
      return day;
    }
  }
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function whenFromNow(day: Date, now: number): string {
  const today = new Date(now);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.round((day.getTime() - midnight) / 86_400_000);
  if (days <= 0) return "Today";
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A one-event calendar file, so the tour lands in whatever calendar the renter uses. */
function downloadCalendarFile(tour: TourRow) {
  const title = tour.listing?.title ?? "Apartment tour";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nestor//Tours//EN",
    "BEGIN:VEVENT",
    `UID:${tour._id}@nestor`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(tour.startsAt)}`,
    `DTEND:${icsStamp(tour.startsAt + TOUR_LENGTH_MS)}`,
    `SUMMARY:${icsText(`Apartment tour: ${title}`)}`,
    ...(tour.listing?.address ? [`LOCATION:${icsText(tour.listing.address)}`] : []),
    `DESCRIPTION:${icsText(`The landlord offered: ${tour.label}. Arranged with Nestor.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nestor-tour.ics";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function DateTile({ date, muted = false }: { date: Date; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center self-start overflow-hidden rounded-xl border text-center",
        muted ? "border-line bg-paper-deep/50 text-ink-faint" : "border-line-strong bg-card text-ink",
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "w-full py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
          muted ? "bg-paper-deep text-ink-faint" : "bg-forest text-paper",
        )}
      >
        {date.toLocaleDateString("en-US", { month: "short" })}
      </span>
      <span className="font-display text-2xl leading-none pt-1.5">{date.getDate()}</span>
      <span className="pb-1.5 pt-0.5 text-[11px] text-ink-faint">
        {date.toLocaleDateString("en-US", { weekday: "short" })}
      </span>
    </div>
  );
}

function ListingLine({ tour, thread }: { tour: TourRow; thread: ThreadRow | undefined }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {tour.listing ? (
          <Link
            to={`/app/listings/${tour.listing._id}`}
            className="min-w-0 font-display text-lg leading-snug text-ink underline-offset-2 hover:text-forest hover:underline"
          >
            {tour.listing.title}
          </Link>
        ) : (
          <span className="font-display text-lg text-ink-soft">A listing you removed</span>
        )}
        {thread?.isSimulated && <Badge tone="honey">Demo landlord</Badge>}
      </div>
      {tour.listing?.address && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tour.listing.address)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-flex max-w-full items-center gap-1 text-sm text-ink-soft underline-offset-2 hover:text-forest hover:underline"
        >
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{tour.listing.address}</span>
        </a>
      )}
    </div>
  );
}

function BookedCard({
  tour,
  thread,
  now,
  busy,
  onCancel,
}: {
  tour: TourRow;
  thread: ThreadRow | undefined;
  now: number;
  busy: boolean;
  onCancel: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="animate-rise p-5 sm:p-6">
      <div className="flex gap-4">
        <DateTile date={tourDay(tour)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="forest" dot>
              Booked
            </Badge>
            <span className="text-sm text-ink-faint">{whenFromNow(tourDay(tour), now)}</span>
          </div>
          <p className="mt-1.5 text-base font-semibold text-ink">{tour.label}</p>
          <div className="mt-1">
            <ListingLine tour={tour} thread={thread} />
          </div>
        </div>
      </div>

      {thread?.pendingDraft && tour.listing && (
        <Callout tone="honey" className="mt-4" title="An email is waiting for your OK">
          Nestor has written to this landlord, and the email will not go out until you approve it.{" "}
          <Link to={`/app/listings/${tour.listing._id}`} className="font-semibold underline underline-offset-2">
            Review and send it
          </Link>
        </Callout>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button
          size="sm"
          variant="secondary"
          icon={<CalendarPlus className="size-4" aria-hidden="true" />}
          onClick={() => downloadCalendarFile(tour)}
        >
          Add to calendar
        </Button>
        {tour.listing && (
          <Link
            to={`/app/listings/${tour.listing._id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            Open the conversation
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-ink-soft">Cancel this tour?</span>
              <Button size="sm" variant="danger" loading={busy} onClick={onCancel}>
                Cancel it
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              Cancel tour
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function OfferGroup({
  tours,
  thread,
  busyId,
  onChoose,
  onDecline,
}: {
  tours: TourRow[];
  thread: ThreadRow | undefined;
  busyId: Id<"tours"> | null;
  onChoose: (tour: TourRow) => void;
  onDecline: (tour: TourRow) => void;
}) {
  const writing = thread?.stage === "drafting";

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="border-b border-line bg-paper-deep/40 px-5 py-4 sm:px-6">
        <ListingLine tour={tours[0]} thread={thread} />
      </div>
      <ul className="divide-y divide-line">
        {tours.map((tour) => (
          <li key={tour._id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
            <DateTile date={tourDay(tour)} />
            <p className="min-w-0 flex-1 basis-40 text-base font-semibold text-ink">{tour.label}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                loading={busyId === tour._id}
                disabled={writing || (busyId !== null && busyId !== tour._id)}
                onClick={() => onChoose(tour)}
              >
                Choose this time
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId !== null}
                onClick={() => onDecline(tour)}
                aria-label={`Decline ${tour.label}`}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-xs text-ink-faint sm:px-6">
        {writing
          ? "Nestor is writing an email for this conversation right now. You can choose in a moment."
          : tours.length > 1
            ? "Choose one and Nestor writes to the landlord to confirm it. The other times are let go."
            : "Choose it and Nestor writes to the landlord to confirm."}
      </p>
    </Card>
  );
}

const PAST_LABEL: Record<TourRow["status"], { text: string; tone: Tone }> = {
  proposed: { text: "Offer passed", tone: "neutral" },
  confirmed: { text: "Booked", tone: "forest" },
  completed: { text: "Done", tone: "forest" },
  declined: { text: "Declined", tone: "neutral" },
};

function PastRow({ tour, thread }: { tour: TourRow; thread: ThreadRow | undefined }) {
  const label = PAST_LABEL[tour.status];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <DateTile date={tourDay(tour)} muted />
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium text-ink-soft">{tour.label}</p>
        <p className="mt-0.5 truncate text-sm text-ink-faint">
          {tour.listing ? (
            <Link to={`/app/listings/${tour.listing._id}`} className="underline-offset-2 hover:text-forest hover:underline">
              {tour.listing.title}
            </Link>
          ) : (
            "A listing you removed"
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {thread?.isSimulated && <Badge tone="honey">Demo landlord</Badge>}
        <Badge tone={label.tone}>{label.text}</Badge>
      </div>
    </li>
  );
}

export function Tours() {
  const tours = useQuery(api.tours.list);
  const threads = useQuery(api.threads.list);
  const choose = useMutation(api.tours.choose);
  const decline = useMutation(api.tours.decline);
  const navigate = useNavigate();
  const now = useNow(60_000);
  const [busyId, setBusyId] = useState<Id<"tours"> | null>(null);

  useEffect(() => {
    document.title = "Tours · Nestor";
  }, []);

  const threadById = useMemo(() => new Map((threads ?? []).map((t) => [t._id, t])), [threads]);

  const { booked, offers, past } = useMemo(() => {
    const rows = tours ?? [];
    // A tour counts as upcoming until it is over, not just until it starts.
    const live = (t: TourRow) => t.startsAt + TOUR_LENGTH_MS >= now;
    const bookedRows = rows.filter((t) => t.status === "confirmed" && live(t));
    const offerRows = rows.filter((t) => t.status === "proposed" && live(t));
    const taken = new Set([...bookedRows, ...offerRows].map((t) => t._id));
    const groups = new Map<Id<"threads">, TourRow[]>();
    for (const tour of offerRows) groups.set(tour.threadId, [...(groups.get(tour.threadId) ?? []), tour]);
    return {
      booked: bookedRows,
      offers: [...groups.values()],
      past: rows.filter((t) => !taken.has(t._id)).sort((a, b) => b.startsAt - a.startsAt),
    };
  }, [tours, now]);

  async function onChoose(tour: TourRow) {
    setBusyId(tour._id);
    try {
      await choose({ tourId: tour._id });
      toast.success(`You picked ${tour.label}. Nestor is writing to confirm it.`);
    } catch (error) {
      toast.error(errorSentence(error));
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(tour: TourRow, wasBooked: boolean) {
    setBusyId(tour._id);
    try {
      await decline({ tourId: tour._id });
      toast.success(
        wasBooked
          ? "Tour cancelled. Open the conversation to tell Nestor what to say to the landlord."
          : "Time declined.",
      );
    } catch (error) {
      toast.error(errorSentence(error));
    } finally {
      setBusyId(null);
    }
  }

  const offerCount = offers.reduce((sum, group) => sum + group.length, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader
        eyebrow="Tours"
        title="Homes you are going to see"
        lede="When a landlord offers times, Nestor lists them here. You choose; Nestor never books a tour for you."
      />

      {tours === undefined ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-36 rounded-card" />
          <Skeleton className="h-36 rounded-card" />
        </div>
      ) : tours.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<CalendarDays className="size-5" aria-hidden="true" />}
          title="No tours yet"
          body="Start a conversation about a listing. When the landlord offers times to see it, they show up here for you to pick."
          action={<Button onClick={() => navigate("/app")}>Go to your listings</Button>}
        />
      ) : (
        <div className="mt-8 space-y-10">
          {offers.length > 0 && (
            <section aria-labelledby="tours-offers">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 id="tours-offers" className="text-2xl text-ink">
                  Waiting for your pick
                </h2>
                <Badge tone="honey" dot pulse className="whitespace-nowrap">
                  {offerCount} {offerCount === 1 ? "time" : "times"} offered
                </Badge>
              </div>
              <div className="mt-4 space-y-4">
                {offers.map((group) => (
                  <OfferGroup
                    key={group[0].threadId}
                    tours={group}
                    thread={threadById.get(group[0].threadId)}
                    busyId={busyId}
                    onChoose={onChoose}
                    onDecline={(tour) => onDecline(tour, false)}
                  />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="tours-booked">
            <h2 id="tours-booked" className="text-2xl text-ink">
              Coming up
            </h2>
            <div className="mt-4 space-y-4">
              {booked.length === 0 ? (
                <p className="rounded-card border border-dashed border-line-strong px-5 py-6 text-sm text-ink-soft">
                  {offers.length > 0
                    ? "Nothing booked yet. Pick one of the times above and it moves here."
                    : "Nothing booked right now. New offers from landlords appear on this page as they arrive."}
                </p>
              ) : (
                booked.map((tour) => (
                  <BookedCard
                    key={tour._id}
                    tour={tour}
                    thread={threadById.get(tour.threadId)}
                    now={now}
                    busy={busyId === tour._id}
                    onCancel={() => onDecline(tour, true)}
                  />
                ))
              )}
            </div>
          </section>

          {past.length > 0 && (
            <section aria-labelledby="tours-past">
              <details className="group" open={booked.length === 0 && offers.length === 0}>
                <summary className="flex cursor-pointer list-none items-baseline gap-3 marker:hidden">
                  <h2 id="tours-past" className="text-2xl text-ink">
                    Past and declined
                  </h2>
                  <span className="text-sm text-ink-faint">{past.length}</span>
                  <span className="ml-auto text-sm text-forest group-open:hidden">Show</span>
                  <span className="ml-auto hidden text-sm text-forest group-open:inline">Hide</span>
                </summary>
                <ul className="mt-2 divide-y divide-line border-t border-line">
                  {past.map((tour) => (
                    <PastRow key={tour._id} tour={tour} thread={threadById.get(tour.threadId)} />
                  ))}
                </ul>
              </details>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
