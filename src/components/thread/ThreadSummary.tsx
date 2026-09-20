import { Check } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { money } from "@/lib/format";

// Mirrors MAX_OUTBOUND_PER_THREAD in convex/lib/negotiationPolicy.ts.
const EMAIL_CAP = 8;

/** Where the negotiation stands: asked, best offer so far, what has been won. */
export function ThreadSummary({
  thread,
  messages,
}: {
  thread: Doc<"threads">;
  messages: Doc<"messages">[];
}) {
  const asked = thread.rentAsked;
  const best = thread.rentBestOffer;
  // An offer from a landlord who said no, or in a conversation the renter closed, is not a saving.
  const over = thread.stage === "declined" || thread.stage === "closed";
  const saved = !over && asked !== undefined && best !== undefined && best < asked ? asked - best : 0;
  const sent = messages.filter((m) => m.direction === "outbound" && m.status === "sent").length;
  const received = messages.filter((m) => m.direction === "inbound").length;

  return (
    <div className="rounded-card border border-line bg-card shadow-card">
      <dl className="grid grid-cols-3 divide-x divide-line">
        <div className="px-4 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Asking</dt>
          <dd className="mt-0.5 font-display text-2xl tabular-nums text-ink">
            {asked !== undefined ? money(asked) : "Not listed"}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Best offer</dt>
          <dd key={best ?? "none"} className="mt-0.5 animate-rise font-display text-2xl tabular-nums text-ink">
            {best !== undefined ? money(best) : <span className="text-base text-ink-faint">None yet</span>}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Saved</dt>
          <dd key={saved} className="mt-0.5 animate-rise font-display text-2xl tabular-nums text-ink">
            {saved > 0 ? (
              <>
                {money(saved)}
                <span className="ml-1 font-sans text-xs text-ink-faint">a month</span>
              </>
            ) : (
              <span className="text-base text-ink-faint">{over ? "Off the table" : "Nothing yet"}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5">
        {thread.concessionsWon.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Concessions won">
            {thread.concessionsWon.map((concession) => (
              <li
                key={concession}
                className="inline-flex animate-rise items-center gap-1 rounded-full border border-forest/15 bg-forest-soft px-2.5 py-0.5 text-xs font-medium text-forest-deep"
              >
                <Check className="size-3" aria-hidden="true" />
                {concession}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">No concessions won yet</p>
        )}
        <p className="ml-auto text-xs tabular-nums text-ink-faint">
          {sent} of {EMAIL_CAP} emails sent, {received} {received === 1 ? "reply" : "replies"}
          {saved > 0 ? `, ${money(saved * 12)} over a year` : ""}
        </p>
      </div>
    </div>
  );
}
