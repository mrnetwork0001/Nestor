import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Badge, Card, Skeleton } from "@/components/ui";
import { errorSentence } from "@/lib/errors";
import { cn } from "@/lib/cn";

const ALWAYS = [
  "Every email opens by saying it was written by Nestor, an AI assistant, on your behalf.",
  "Your maximum budget is never mentioned, even if a landlord asks.",
  "Nestor never agrees to sign, pay, place a deposit, or share ID or bank details.",
  "It never invents other offers, deadlines or facts about you.",
  "You pick the tour time. Questions only you can answer wait for you.",
  "It stops after 8 emails in one conversation, and after 10 emails to real landlords in a day. Past that, drafts wait for you again.",
];

export function AutopilotCard() {
  const renter = useQuery(api.renters.me);
  const setAutopilot = useMutation(api.renters.setAutopilot);
  // Shown while the mutation is in flight so the switch responds at once.
  const [pending, setPending] = useState<boolean | null>(null);

  if (renter === undefined) {
    return (
      <Card className="p-6 sm:p-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-4 h-16" />
      </Card>
    );
  }
  if (renter === null) return null;

  const on = pending ?? renter.autopilot;

  async function toggle() {
    const next = !on;
    setPending(next);
    try {
      await setAutopilot({ autopilot: next });
      toast.success(
        next
          ? "Autopilot is on. Nestor sends emails without waiting for you."
          : "Autopilot is off. Every email waits for your OK.",
      );
    } catch (error) {
      toast.error(errorSentence(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id="autopilot-heading" className="text-2xl text-ink">
                Autopilot
              </h2>
              <Badge tone={on ? "clay" : "neutral"} dot={on} pulse={on}>
                {on ? "On" : "Off"}
              </Badge>
            </div>
            <p id="autopilot-help" className="mt-2 leading-relaxed text-ink-soft">
              {on
                ? "Nestor sends each email as soon as it has written it: the first inquiry and every reply to the landlord. You read along on the dashboard."
                : "Every email Nestor writes waits as a draft. You can edit it, ask for a rewrite, or discard it, and nothing goes out until you approve it."}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="autopilot-heading"
            aria-describedby="autopilot-help"
            disabled={pending !== null}
            onClick={toggle}
            className={cn(
              "relative mt-1 h-8 w-14 shrink-0 cursor-pointer rounded-full border transition-colors disabled:cursor-wait",
              on ? "border-clay bg-clay" : "border-line-strong bg-paper-deep",
            )}
          >
            <span
              className={cn(
                "absolute top-1/2 left-1 size-6 -translate-y-1/2 rounded-full bg-card shadow-sm transition-transform",
                on && "translate-x-6",
              )}
            />
          </button>
        </div>

        {renter.isGuest && (
          <p className="mt-4 rounded-xl border border-honey/25 bg-honey-soft px-4 py-3 text-sm text-honey">
            As a guest, Nestor only writes to its demo landlord, so autopilot is a safe way to watch a whole
            negotiation play out on its own.
          </p>
        )}
      </div>

      <div className="border-t border-line bg-paper-deep/40 px-6 py-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">True either way</p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          {ALWAYS.map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
