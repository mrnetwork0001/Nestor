import { useRef, useState, type DragEvent } from "react";
import { useMutation } from "convex/react";
import { FileText, UploadCloud } from "@/components/icons";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, Select } from "@/components/ui";
import { errorSentence } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { fileSize, refuseFile } from "./leaseHelpers";

type Phase =
  | { step: "idle" }
  | { step: "checking"; name: string }
  | { step: "uploading"; name: string; size: number; fraction: number }
  | { step: "saving"; name: string };

export interface ListingOption {
  _id: Id<"listings">;
  label: string;
}

/** POST the file to the one-time Convex upload URL. XHR, because fetch has no upload progress. */
function postFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<Id<"_storage">> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    // Browsers sometimes report no type for a PDF; the name was already checked.
    xhr.setRequestHeader("Content-Type", file.type || "application/pdf");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`upload failed with status ${xhr.status}`));
        return;
      }
      try {
        const parsed = JSON.parse(xhr.responseText) as { storageId?: string };
        if (typeof parsed.storageId !== "string") throw new Error("no storage id");
        resolve(parsed.storageId as Id<"_storage">);
      } catch {
        reject(new Error("unexpected upload response"));
      }
    };
    xhr.send(file);
  });
}

export function UploadZone({
  listings,
  defaultListingId,
  compact,
  onCreated,
}: {
  listings: ListingOption[];
  defaultListingId: Id<"listings"> | null;
  compact: boolean;
  onCreated: (auditId: Id<"leaseAudits">) => void;
}) {
  const generateUploadUrl = useMutation(api.leaseAudits.generateUploadUrl);
  const createAudit = useMutation(api.leaseAudits.create);

  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [listingChoice, setListingChoice] = useState<string | null>(null);

  const busy = phase.step !== "idle";
  // The renter's own pick wins; until then, follow the listing the page was opened for.
  const chosen = listingChoice ?? defaultListingId ?? "";
  const listingId = listings.find((l) => l._id === chosen)?._id;

  async function handleFile(file: File) {
    if (busy) return;
    setProblem(null);
    setPhase({ step: "checking", name: file.name });
    try {
      const refusal = await refuseFile(file);
      if (refusal !== null) {
        setProblem(refusal);
        return;
      }
      const uploadUrl = await generateUploadUrl({});
      setPhase({ step: "uploading", name: file.name, size: file.size, fraction: 0 });
      const storageId = await postFile(uploadUrl, file, (fraction) =>
        setPhase({ step: "uploading", name: file.name, size: file.size, fraction }),
      );
      setPhase({ step: "saving", name: file.name });
      const auditId = await createAudit({ storageId, fileName: file.name, listingId });
      onCreated(auditId);
      toast.success("Lease uploaded. Nestor is reading it now.");
    } catch (error) {
      const sentence = errorSentence(
        error,
        "The upload did not go through. Check your connection and try again.",
      );
      setProblem(sentence);
      toast.error(sentence);
    } finally {
      setPhase({ step: "idle" });
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    if (files.length > 1) {
      setProblem("Drop one lease at a time.");
      return;
    }
    void handleFile(files[0]);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "rounded-card border-2 border-dashed px-5 text-center transition-colors",
          compact ? "py-6" : "py-10",
          dragging ? "border-forest bg-forest-soft/60" : "border-line-strong bg-card",
        )}
      >
        <input
          ref={inputRef}
          id="lease-file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {phase.step === "idle" ? (
          <>
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-forest-soft text-forest">
              <UploadCloud className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-3 font-display text-lg text-ink">
              {dragging ? "Drop it here" : "Drop your lease PDF here"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">PDF only, up to 15 MB. Scans are fine.</p>
            <Button className="mt-4" variant="secondary" onClick={() => inputRef.current?.click()}>
              Choose a PDF
            </Button>
          </>
        ) : (
          <div className="mx-auto max-w-xs" role="status" aria-live="polite">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-sky-soft text-sky">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-3 truncate text-sm font-medium text-ink" title={phase.name}>
              {phase.name}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {phase.step === "checking" && "Checking the file"}
              {phase.step === "uploading" &&
                `Uploading ${fileSize(phase.size)}: ${Math.round(phase.fraction * 100)}%`}
              {phase.step === "saving" && "Handing it to Nestor"}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-deep">
              <div
                className="h-full rounded-full bg-forest transition-[width] duration-200"
                style={{
                  width:
                    phase.step === "uploading"
                      ? `${Math.max(4, Math.round(phase.fraction * 100))}%`
                      : phase.step === "saving"
                        ? "100%"
                        : "4%",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {problem && (
        <p role="alert" className="rounded-xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-sm text-clay-deep">
          {problem}
        </p>
      )}

      {listings.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="lease-listing" className="block text-sm font-medium text-ink">
            Which home is this lease for? <span className="font-normal text-ink-faint">Optional</span>
          </label>
          <Select
            id="lease-listing"
            value={chosen}
            disabled={busy}
            onChange={(event) => setListingChoice(event.target.value)}
          >
            <option value="">Not on my board</option>
            {listings.map((listing) => (
              <option key={listing._id} value={listing._id}>
                {listing.label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
