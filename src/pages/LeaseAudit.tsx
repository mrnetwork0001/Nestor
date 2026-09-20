import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, FileSearch, Lock } from "lucide-react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AuditList } from "@/components/lease/AuditList";
import { AuditResult, LegalNote } from "@/components/lease/AuditResult";
import { UploadZone, type ListingOption } from "@/components/lease/UploadZone";
import { CHECKLIST, useNow } from "@/components/lease/leaseHelpers";
import { Button, Callout, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { errorSentence } from "@/lib/errors";

const STEPS = [
  {
    title: "Upload the PDF",
    body: "The lease the landlord sent you, as a PDF. A phone scan works.",
  },
  {
    title: "Nestor reads every clause",
    body: "It quotes the risky ones word for word, says why they matter in plain language, and ranks them.",
  },
  {
    title: "Send back one email",
    body: "Each flag comes with a polite request. Tick the ones you want and copy them as a single email.",
  },
];

function Intro({ onSample, sampleBusy }: { onSample: () => void; sampleBusy: boolean }) {
  return (
    <div className="space-y-5">
      <EmptyState
        icon={<FileSearch className="size-5" aria-hidden="true" />}
        title="No lease checked yet"
        body="Upload the lease you were sent, or see how a review looks with Nestor's sample lease: a made-up one-year apartment lease with a few traps in it."
        action={
          <Button loading={sampleBusy} onClick={onSample}>
            Try the sample lease
          </Button>
        }
      />

      <Card className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">How it works</p>
        <ol className="mt-4 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <p className="font-display text-3xl text-clay">{i + 1}</p>
              <h3 className="mt-1 text-lg text-ink">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 border-t border-line pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">What Nestor looks for</p>
          <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm text-ink-soft sm:grid-cols-2">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <LegalNote />
    </div>
  );
}

export function LeaseAudit() {
  const audits = useQuery(api.leaseAudits.list);
  const listings = useQuery(api.listings.list);
  const renter = useQuery(api.renters.me);
  const status = useQuery(api.system.status);
  const runSample = useMutation(api.leaseAudits.runSample);

  const [params, setParams] = useSearchParams();
  const [sampleBusy, setSampleBusy] = useState(false);
  const now = useNow(30_000);
  const uploadRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Lease check · Nestor";
  }, []);

  const listingOptions = useMemo<ListingOption[]>(
    () =>
      (listings ?? [])
        .filter((listing) => listing.status === "ready")
        .map((listing) => ({
          _id: listing._id,
          label: listing.title ?? listing.address ?? "Rental listing",
        })),
    [listings],
  );

  // Ids from the URL are only ever matched against rows the renter owns, never sent to the server.
  const wanted = params.get("audit");
  const selected = audits?.find((audit) => audit._id === wanted) ?? audits?.[0] ?? null;
  const defaultListingId = listingOptions.find((l) => l._id === params.get("listing"))?._id ?? null;
  const selectedListing =
    selected?.listingId !== undefined
      ? (listingOptions.find((l) => l._id === selected.listingId) ?? null)
      : null;

  function select(auditId: Id<"leaseAudits">, scroll: boolean) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("audit", auditId);
        return next;
      },
      { replace: true },
    );
    if (scroll) {
      // The result sits below the list on phones; bring it into view.
      window.requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  function clearSelection() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("audit");
        return next;
      },
      { replace: true },
    );
  }

  async function onSample() {
    setSampleBusy(true);
    try {
      const auditId = await runSample({});
      select(auditId, true);
    } catch (error) {
      toast.error(errorSentence(error));
    } finally {
      setSampleBusy(false);
    }
  }

  const hasAudits = audits !== undefined && audits.length > 0;
  const hasSample = audits?.some((audit) => audit.isSample && audit.status !== "failed") ?? false;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader
        eyebrow="Lease check"
        title="Read the fine print before you sign"
        lede="Upload the lease you were sent. Nestor quotes every clause that could cost you, explains it in plain language and writes the request to send back."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
        <aside className="space-y-6 lg:sticky lg:top-8 lg:-mx-1 lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:overflow-y-auto lg:px-1 lg:pb-1">
          <div ref={uploadRef} className="scroll-mt-6 space-y-3">
            {status !== undefined && !status.openai ? (
              <Callout tone="honey" title="Lease check is in demo mode">
                OpenAI is not connected on this deployment, so Nestor cannot read your own PDF yet. The
                sample lease shows a pre-written example review, labelled as one.
              </Callout>
            ) : (
              <UploadZone
                listings={listingOptions}
                defaultListingId={defaultListingId}
                compact={hasAudits}
                onCreated={(auditId) => select(auditId, true)}
              />
            )}

            {hasAudits && (
              <Button variant="secondary" className="w-full" loading={sampleBusy} onClick={onSample}>
                {hasSample ? "Open the sample lease review" : "Try the sample lease"}
              </Button>
            )}

            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Your PDF is stored privately in Nestor and sent to OpenAI only for this review. The copy at
                OpenAI is deleted as soon as the review ends. Delete a check here and its PDF goes with it.
              </span>
            </p>
          </div>

          <section aria-labelledby="your-checks">
            <h2 id="your-checks" className="text-lg text-ink">
              Your lease checks
            </h2>
            <div className="mt-3">
              {audits === undefined ? (
                <div className="space-y-2">
                  <Skeleton className="h-[5.25rem] rounded-xl" />
                  <Skeleton className="h-[5.25rem] rounded-xl" />
                </div>
              ) : audits.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-sm text-ink-faint">
                  Checks you run appear here, with their status updating live.
                </p>
              ) : (
                <AuditList
                  audits={audits}
                  selectedId={selected?._id ?? null}
                  now={now}
                  onSelect={(auditId) => select(auditId, true)}
                />
              )}
            </div>
          </section>
        </aside>

        <div ref={resultRef} className="min-w-0 scroll-mt-6">
          {audits === undefined ? (
            <div className="space-y-5">
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="h-64 rounded-card" />
              <Skeleton className="h-48 rounded-card" />
            </div>
          ) : selected === null ? (
            <Intro onSample={onSample} sampleBusy={sampleBusy} />
          ) : (
            <AuditResult
              audit={selected}
              listing={selectedListing}
              signature={renter?.displayName}
              now={now}
              onRemoved={clearSelection}
              onUploadAgain={() => {
                uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                document.getElementById("lease-file")?.click();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
