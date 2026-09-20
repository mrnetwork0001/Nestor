import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Binoculars, FlaskConical, Link as LinkIcon } from "@/components/icons";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button, Callout, Card, Input } from "@/components/ui";
import { toastError, type SystemStatus } from "@/components/listing/helpers";

/** Paste a link, let the Scout search, or load the bundled samples. Each one only inserts rows; the board fills in live. */
export function AddListingBar({
  status,
  city,
  knownListingIds,
  hasSamples,
}: {
  status: SystemStatus | undefined;
  city: string | undefined;
  knownListingIds: ReadonlySet<string>;
  hasSamples: boolean;
}) {
  const addByUrl = useMutation(api.listings.addByUrl);
  const discover = useMutation(api.listings.discover);
  const loadSamples = useMutation(api.listings.loadSamples);

  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"add" | "discover" | "samples" | null>(null);
  const scoutDemo = status !== undefined && !status.firecrawl;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy !== null) return;
    if (url.trim() === "") {
      toast.error("Paste the link to a rental listing first.");
      return;
    }
    setBusy("add");
    try {
      const listingId = await addByUrl({ url });
      setUrl("");
      if (knownListingIds.has(listingId)) {
        toast("That listing is already on your board.");
      } else {
        toast.success("The Scout is reading that page. Watch the card fill in.");
      }
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  async function onDiscover() {
    if (busy !== null) return;
    setBusy("discover");
    try {
      const { demo } = await discover({});
      if (demo) {
        toast("The Scout is in demo mode, so it loaded sample listings instead of searching the web.");
      } else {
        toast.success(
          `The Scout is searching${city ? ` ${city}` : ""}. New listings appear over the next half minute.`,
        );
      }
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  async function onSamples() {
    if (busy !== null) return;
    setBusy("samples");
    try {
      const added = await loadSamples({});
      if (added === 0) toast("The sample listings are already on your board.");
      else toast.success(`Loading ${added} sample listings with a demo landlord.`);
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-2.5 sm:flex-row" noValidate>
        <label htmlFor="listing-url" className="sr-only">
          Link to a rental listing
        </label>
        <div className="relative flex-1">
          <LinkIcon
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <Input
            id="listing-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a listing link from Zumper, PadMapper, Apartment List, Redfin..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="h-11 pl-10"
          />
        </div>
        <Button type="submit" size="lg" className="h-11" loading={busy === "add"} disabled={busy !== null}>
          Scout this listing
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        <p className="mr-1 text-sm text-ink-faint">No link handy?</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={onDiscover}
          loading={busy === "discover"}
          disabled={busy !== null}
          icon={<Binoculars className="size-3.5" />}
        >
          Find listings for me
        </Button>
        {!hasSamples && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSamples}
            loading={busy === "samples"}
            disabled={busy !== null}
            icon={<FlaskConical className="size-3.5" />}
          >
            Load sample listings
          </Button>
        )}
      </div>

      {scoutDemo && (
        <Callout tone="honey" className="mt-3" title="The Scout is in demo mode">
          Reading a pasted link and searching the web need a Firecrawl key, which this deployment does not have.
          Sample listings work in full, with a demo landlord on the other side.
        </Callout>
      )}
    </Card>
  );
}
