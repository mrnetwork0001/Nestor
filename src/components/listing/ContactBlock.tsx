import { useId, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { AtSign, ExternalLink, Phone, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge, Button, Callout, Card, Field, Input } from "@/components/ui";
import { hostOf, isWebUrl, toastError, type SystemStatus } from "./helpers";

type Listing = Doc<"listings">;

const SOURCE_LABEL: Record<NonNullable<Listing["contactEmailSource"]>, string> = {
  listing: "Published on the listing",
  scout_search: "Found by the Scout on the property's own site",
  renter: "Added by you",
  sample: "Sample",
};

function ManualEmailForm({
  listing,
  submitLabel,
  onSaved,
}: {
  listing: Listing;
  submitLabel: string;
  onSaved?: () => void;
}) {
  const setContactEmail = useMutation(api.listings.setContactEmail);
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (email.trim() === "") {
      toast.error("Type the landlord's or leasing office's email first.");
      return;
    }
    setSaving(true);
    try {
      await setContactEmail({ listingId: listing._id, email });
      setEmail("");
      toast.success("Saved. Nestor will write to that address once you approve the email.");
      onSaved?.();
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field
        label="Landlord or leasing office email"
        htmlFor={inputId}
        hint="Only use an address the landlord published or gave you. Nestor never guesses one."
      >
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="leasing@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" variant="secondary" loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </Field>
    </form>
  );
}

/**
 * Who Nestor would write to. Rental portals rarely publish an email, so the
 * Scout can look for the leasing office's own site; the renter always picks
 * the address, and every candidate links to the page it was found on.
 */
export function ContactBlock({
  listing,
  status,
  locked,
}: {
  listing: Listing;
  status: SystemStatus | undefined;
  /** A conversation already exists, so the address it uses can no longer change. */
  locked: boolean;
}) {
  const findContact = useMutation(api.listings.findContact);
  const setContactEmail = useMutation(api.listings.setContactEmail);
  const [searching, setSearching] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);

  const scoutDemo = status !== undefined && !status.firecrawl;
  const isSearching = listing.contactSearch === "searching";

  async function onFind() {
    if (searching || isSearching) return;
    setSearching(true);
    try {
      await findContact({ listingId: listing._id });
    } catch (error) {
      toastError(error);
    } finally {
      setSearching(false);
    }
  }

  async function onChoose(email: string) {
    if (choosing !== null) return;
    setChoosing(email);
    try {
      await setContactEmail({ listingId: listing._id, email, fromCandidate: true });
      setEditing(false);
      toast.success("Got it. Nestor will write to that address once you approve the email.");
    } catch (error) {
      toastError(error);
    } finally {
      setChoosing(null);
    }
  }

  async function onRemove() {
    if (removing) return;
    setRemoving(true);
    try {
      await setContactEmail({ listingId: listing._id, email: "" });
    } catch (error) {
      toastError(error);
    } finally {
      setRemoving(false);
    }
  }

  const person = (listing.contactName || listing.contactPhone) && (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
      {listing.contactName && (
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-4 text-ink-faint" aria-hidden="true" />
          {listing.contactName}
        </span>
      )}
      {listing.contactPhone && (
        <span className="inline-flex items-center gap-1.5">
          <Phone className="size-4 text-ink-faint" aria-hidden="true" />
          {listing.contactPhone}
        </span>
      )}
    </div>
  );

  if (listing.isSample) {
    return (
      <Card className="space-y-3 p-5">
        <h2 className="text-xl text-ink">Landlord contact</h2>
        {person}
        <Callout tone="honey" title="Sample listing, demo landlord">
          This home is invented, so there is nobody real to email. Nestor plays{" "}
          {listing.contactName ?? "the landlord"} and answers the way a leasing office would, so you can try the
          whole conversation safely.
        </Callout>
      </Card>
    );
  }

  const candidates = listing.contactCandidates;
  const showCandidates = candidates.length > 0 && (!listing.contactEmail || editing) && !locked;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl text-ink">Landlord contact</h2>
        {isSearching && (
          <Badge tone="sky" dot pulse>
            Scout is searching
          </Badge>
        )}
      </div>
      {person}

      {listing.contactEmail ? (
        <div className="animate-rise rounded-xl border border-forest/20 bg-forest-soft/60 px-4 py-3">
          <p className="flex items-center gap-2 break-all text-sm font-semibold text-ink">
            <AtSign className="size-4 shrink-0 text-forest" aria-hidden="true" />
            {listing.contactEmail}
          </p>
          {listing.contactEmailSource && (
            <p className="mt-0.5 pl-6 text-xs text-ink-soft">{SOURCE_LABEL[listing.contactEmailSource]}</p>
          )}
          {!locked && (
            <div className="mt-2 flex gap-1 pl-4">
              <Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)}>
                {editing ? "Keep this one" : "Use a different address"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onRemove} loading={removing}>
                Remove
              </Button>
            </div>
          )}
        </div>
      ) : (
        !locked && (
          <p className="text-sm leading-relaxed text-ink-soft">
            Rental sites almost never publish a landlord's email. The Scout can look for this property's own
            leasing-office website and bring back only addresses that are actually printed there.
          </p>
        )
      )}

      {locked && !listing.contactEmail && (
        <p className="text-sm text-ink-soft">
          No email is saved for this listing. The conversation on this page runs with Nestor's demo landlord.
        </p>
      )}

      {!locked && (!listing.contactEmail || editing) && (
        <>
          {isSearching ? (
            <div className="flex animate-rise items-start gap-3 rounded-xl border border-sky/20 bg-sky-soft px-4 py-3 text-sm text-sky">
              <Search className="mt-0.5 size-4 shrink-0 animate-pulse-dot" aria-hidden="true" />
              <p>
                Searching for the leasing office's own website and reading its contact pages. This usually takes
                under a minute, and results appear here on their own.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={candidates.length > 0 || listing.contactSearch ? "secondary" : "primary"}
                onClick={onFind}
                loading={searching}
                disabled={scoutDemo}
                icon={<Search className="size-4" />}
              >
                {listing.contactSearch ? "Search again" : "Find the leasing office's email"}
              </Button>
              {scoutDemo && (
                <p className="text-xs text-ink-faint">
                  The Scout is in demo mode and cannot search the web. Type the address in below.
                </p>
              )}
            </div>
          )}

          {!isSearching && listing.contactSearch === "done" && candidates.length === 0 && (
            <Callout tone="neutral" title="No published email found">
              Many leasing offices only offer a contact form. If the landlord gave you an address, add it below,
              or try the full flow with the demo landlord.
            </Callout>
          )}
          {!isSearching && listing.contactSearch === "failed" && (
            <Callout tone="clay" title="The search did not finish">
              You can search again, or type the address in yourself.
            </Callout>
          )}

          {showCandidates && (
            <div className="animate-rise">
              <p className="text-sm font-semibold text-ink">
                {candidates.length === 1 ? "The Scout found one address" : `The Scout found ${candidates.length} addresses`}
              </p>
              <ul className="mt-2 space-y-2">
                {candidates.map((candidate) => {
                  const host = hostOf(candidate.sourceUrl);
                  return (
                    <li
                      key={candidate.email}
                      className="flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium text-ink">{candidate.email}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {candidate.label ? `${candidate.label} · ` : ""}
                          {isWebUrl(candidate.sourceUrl) ? (
                            <a
                              href={candidate.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-forest hover:underline"
                            >
                              Printed on {host ?? "the source page"}
                              <ExternalLink className="size-3" aria-hidden="true" />
                            </a>
                          ) : (
                            "Source page unavailable"
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onChoose(candidate.email)}
                        loading={choosing === candidate.email}
                        disabled={choosing !== null || candidate.email === listing.contactEmail}
                      >
                        {candidate.email === listing.contactEmail ? "In use" : "Use this address"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <ManualEmailForm
            listing={listing}
            submitLabel={listing.contactEmail ? "Replace" : "Save"}
            onSaved={() => setEditing(false)}
          />
        </>
      )}
    </Card>
  );
}
