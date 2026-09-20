import { useState } from "react";
import { useMutation } from "convex/react";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui";
import { toastError } from "@/components/listing/helpers";

/**
 * The label is the landlord's own wording, in the property's time zone. The
 * renter's browser may be elsewhere, so the hint is relative, never a clock time.
 */
function whenHint(startsAt: number, now: number): string {
  const hours = (startsAt - now) / 3_600_000;
  if (hours < 0) return "This time has passed";
  if (hours < 1) return "Within the hour";
  if (hours < 24) return `In about ${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return days === 1 ? "In about a day" : `In ${days} days`;
}

/**
 * Tour times the landlord offered. They stay "proposed" until the renter
 * picks one; only then does the Negotiator write to confirm it.
 */
export function TourOptions({
  tours,
  stage,
  now,
}: {
  tours: Doc<"tours">[];
  stage: Doc<"threads">["stage"];
  now: number;
}) {
  const choose = useMutation(api.tours.choose);
  const decline = useMutation(api.tours.decline);
  const [busy, setBusy] = useState<{ id: Id<"tours">; kind: "choose" | "decline" } | null>(null);

  const over = stage === "declined" || stage === "closed";
  const confirmed = tours.find((t) => t.status === "confirmed");
  const proposed = over ? [] : tours.filter((t) => t.status === "proposed" && t.startsAt > now - 3_600_000);
  if (!confirmed && proposed.length === 0) return null;

  const writing = stage === "drafting";

  async function run(tour: Doc<"tours">, kind: "choose" | "decline") {
    if (busy !== null) return;
    setBusy({ id: tour._id, kind });
    try {
      if (kind === "choose") {
        await choose({ tourId: tour._id });
        toast.success(`${tour.label} it is. Nestor is writing to confirm.`);
      } else {
        await decline({ tourId: tour._id });
      }
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Tours" className="animate-rise space-y-2.5">
      {confirmed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-forest/20 bg-forest-soft px-4 py-3.5">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-forest-deep">
                {confirmed.startsAt < now ? "Tour" : "Tour booked"}: {confirmed.label}
              </p>
              <p className="text-xs text-ink-soft">
                {whenHint(confirmed.startsAt, now)}. The time is local to the property.{" "}
                <Link to="/app/tours" className="font-medium text-forest underline underline-offset-2">
                  See all tours
                </Link>
              </p>
            </div>
          </div>
          {!over && confirmed.startsAt > now && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => run(confirmed, "decline")}
              loading={busy?.id === confirmed._id}
              disabled={busy !== null}
            >
              Cancel tour
            </Button>
          )}
        </div>
      )}

      {proposed.length > 0 && (
        <div className="rounded-card border border-line bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-forest" aria-hidden="true" />
            <h3 className="font-sans text-sm font-semibold text-ink">
              {confirmed ? "Other times on offer" : "Pick a tour time"}
            </h3>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {writing
              ? "Nestor is writing right now. You can choose as soon as it finishes."
              : "Choose one and Nestor writes to the landlord to confirm it. Nothing is booked until you choose."}{" "}
            Times are local to the property.
          </p>
          <ul className="mt-3 space-y-2">
            {proposed.map((tour) => (
              <li
                key={tour._id}
                className="flex animate-rise flex-col gap-2 rounded-xl border border-line px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{tour.label}</p>
                  <p className="text-xs text-ink-faint">{whenHint(tour.startsAt, now)}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => run(tour, "choose")}
                    loading={busy?.id === tour._id && busy.kind === "choose"}
                    disabled={busy !== null || writing}
                  >
                    Choose
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(tour, "decline")}
                    loading={busy?.id === tour._id && busy.kind === "decline"}
                    disabled={busy !== null}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
