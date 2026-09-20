import { useState } from "react";
import { useMutation } from "convex/react";
import { PenLine, ShieldCheck } from "@/components/icons";
import { Link } from "react-router";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button, Callout, Card } from "@/components/ui";
import { toastError, type SystemStatus } from "@/components/listing/helpers";

/**
 * The step before a conversation exists. It spells out who Nestor will write
 * to (a real landlord or the demo landlord) before anything is drafted.
 */
export function StartNegotiation({
  listing,
  renter,
  status,
}: {
  listing: Doc<"listings">;
  renter: Doc<"renters"> | null | undefined;
  status: SystemStatus | undefined;
}) {
  const start = useMutation(api.threads.start);
  const [busy, setBusy] = useState<"real" | "demo" | null>(null);

  async function begin(useDemoLandlord: boolean) {
    if (busy !== null) return;
    setBusy(useDemoLandlord ? "demo" : "real");
    try {
      await start({ listingId: listing._id, useDemoLandlord });
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  const ready = listing.status === "ready";
  const inboxDemo = status !== undefined && !status.agentmail;
  const isGuest = renter?.isGuest === true;
  const onlyDemo = listing.isSample || inboxDemo;
  const canEmailLandlord = !onlyDemo && !isGuest && Boolean(listing.contactEmail);

  return (
    <Card className="p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Negotiator</p>
      <h2 className="mt-0.5 text-2xl text-ink">Let Nestor write to the landlord</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Nestor drafts a short inquiry from your Passport facts and this listing, asks for a tour, and raises at most
        two things worth negotiating.{" "}
        {renter?.autopilot
          ? "Autopilot is on, so it sends without waiting for you."
          : "Nothing is sent until you approve it."}
      </p>

      <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
        {[
          "Says up front that it is an AI assistant writing for you",
          "Never invents offers or deadlines, and never reveals your budget",
          "Never agrees to sign or pay anything: decisions stay with you",
        ].map((line) => (
          <li key={line} className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-3">
        {!ready ? (
          <Callout tone="sky" title="The Scout is still reading this listing">
            You can start the conversation as soon as the details land.
          </Callout>
        ) : onlyDemo ? (
          <>
            <Callout tone="honey" title={listing.isSample ? "This is a sample listing" : "The inbox is in demo mode"}>
              {listing.isSample
                ? "The conversation runs with Nestor's demo landlord, who replies within seconds. No email reaches a real person."
                : "This deployment has no AgentMail key, so the conversation runs with Nestor's demo landlord and stays inside Nestor."}
            </Callout>
            <Button size="lg" onClick={() => begin(false)} loading={busy === "real"} icon={<PenLine className="size-4" />}>
              Start negotiating
            </Button>
          </>
        ) : (
          <>
            {isGuest ? (
              <Callout tone="honey" title="You are browsing as a guest">
                Guests can try the full flow with the demo landlord.{" "}
                <Link to="/app/settings" className="font-semibold underline underline-offset-2">
                  Create a free account
                </Link>{" "}
                to email real landlords.
              </Callout>
            ) : !listing.contactEmail ? (
              <Callout tone="neutral" title="Add the landlord's email first">
                Nestor never guesses an address. Find or add one under Landlord contact, or use the demo landlord
                to see how the conversation goes.
              </Callout>
            ) : (
              <p className="text-sm text-ink-soft">
                The email will go to <span className="break-all font-semibold text-ink">{listing.contactEmail}</span>{" "}
                from Nestor's own AgentMail inbox.
              </p>
            )}
            <div className="flex flex-wrap gap-2.5">
              {canEmailLandlord && (
                <Button
                  size="lg"
                  onClick={() => begin(false)}
                  loading={busy === "real"}
                  disabled={busy !== null}
                  icon={<PenLine className="size-4" />}
                >
                  Start negotiating
                </Button>
              )}
              <Button
                size="lg"
                variant={canEmailLandlord ? "secondary" : "primary"}
                onClick={() => begin(true)}
                loading={busy === "demo"}
                disabled={busy !== null}
              >
                {canEmailLandlord ? "Use the demo landlord instead" : "Try it with the demo landlord"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
