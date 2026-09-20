import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, FileText, Mail, Scale, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, Callout, Card } from "@/components/ui";
import { errorSentence } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { RISK_TONE, timeAgo } from "@/lib/format";
import { AuditProgress } from "./AuditProgress";
import { CopyButton } from "./CopyButton";
import { FlagCard } from "./FlagCard";
import {
  ASK_EMAIL_SUBJECT,
  RISK_VERDICT,
  SEVERITIES,
  SEVERITY_COPY,
  composeAskEmail,
  countBySeverity,
  tallySentence,
  type Audit,
  type Severity,
} from "./leaseHelpers";

const VERDICT_TEXT: Record<Severity, string> = {
  high: "text-clay-deep",
  medium: "text-honey",
  low: "text-forest",
};

const SEGMENT: Record<Severity, string> = {
  high: "bg-clay",
  medium: "bg-honey",
  low: "bg-moss",
};

function Header({
  audit,
  listing,
  now,
  onRemoved,
}: {
  audit: Audit;
  listing: { _id: Id<"listings">; label: string } | null;
  now: number;
  onRemoved: () => void;
}) {
  const remove = useMutation(api.leaseAudits.remove);
  // Only uploaded leases have a stored file; the link is short-lived, so it is fetched on view.
  const detail = useQuery(api.leaseAudits.get, audit.storageId ? { auditId: audit._id } : "skip");
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function onDelete() {
    setRemoving(true);
    try {
      await remove({ auditId: audit._id });
      toast.success(audit.storageId ? "Lease check and PDF deleted." : "Lease check deleted.");
      onRemoved();
    } catch (error) {
      toast.error(errorSentence(error));
      setRemoving(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 className="truncate text-2xl text-ink" title={audit.fileName}>
          {audit.fileName}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-faint">
          {audit.status === "analyzing"
            ? `Started ${timeAgo(audit._creationTime, now)}`
            : `${audit.status === "failed" ? "Stopped" : "Checked"} ${timeAgo(audit.completedAt ?? audit._creationTime, now)}`}
          {listing && (
            <>
              <span aria-hidden="true">·</span>
              <Link to={`/app/listings/${listing._id}`} className="text-forest underline-offset-2 hover:underline">
                {listing.label}
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {detail?.fileUrl && (
          <a
            href={detail.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-card px-3 text-sm font-medium text-ink transition-colors hover:border-forest hover:text-forest"
          >
            <FileText className="size-4" aria-hidden="true" />
            Open the PDF
            <ExternalLink className="size-3.5 text-ink-faint" aria-hidden="true" />
          </a>
        )}
        {confirming ? (
          <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
            <span className="text-sm text-ink-soft">
              {audit.storageId ? "Delete this check and its PDF?" : "Delete this check?"}
            </span>
            <Button size="sm" variant="danger" loading={removing} onClick={onDelete}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" disabled={removing} onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="size-4" aria-hidden="true" />}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function Failed({ audit, onUploadAgain }: { audit: Audit; onUploadAgain: () => void }) {
  const runSample = useMutation(api.leaseAudits.runSample);
  const [retrying, setRetrying] = useState(false);

  return (
    <Card className="animate-rise p-6 sm:p-8">
      <Callout
        tone="clay"
        icon={<TriangleAlert className="size-4" aria-hidden="true" />}
        title="Nestor could not check this one"
      >
        {audit.error ?? "The lease check could not finish. Please try again."}
      </Callout>
      <div className="mt-5 flex flex-wrap gap-2">
        {audit.isSample ? (
          <Button
            loading={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await runSample({});
              } catch (error) {
                toast.error(errorSentence(error));
              } finally {
                setRetrying(false);
              }
            }}
          >
            Try the sample again
          </Button>
        ) : (
          <Button onClick={onUploadAgain}>Upload it again</Button>
        )}
      </div>
      {!audit.isSample && (
        <p className="mt-4 text-sm text-ink-faint">
          {audit.storageId
            ? "Your PDF is still stored privately with this check. Delete the check to delete the PDF."
            : "This file was refused before any review, so it was not kept and was not sent anywhere."}
        </p>
      )}
    </Card>
  );
}

function Verdict({ audit }: { audit: Audit }) {
  const risk: Severity = audit.overallRisk ?? "low";
  const counts = countBySeverity(audit.flags);
  const total = audit.flags.length;

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={RISK_TONE[risk]} dot>
            Overall: {risk} risk
          </Badge>
          {audit.isSample && <Badge tone="honey">Sample lease</Badge>}
          {audit.model ? (
            <Badge tone="neutral">Live review by OpenAI</Badge>
          ) : (
            <Badge tone="honey">Pre-written example</Badge>
          )}
        </div>

        <p className={cn("mt-4 font-display text-3xl leading-tight tracking-[-0.015em] sm:text-4xl", VERDICT_TEXT[risk])}>
          {RISK_VERDICT[risk].label}
        </p>
        <p className="mt-1.5 text-ink-soft">{RISK_VERDICT[risk].line}</p>

        {total > 0 && (
          <div className="mt-6">
            <div
              className="flex h-2 gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={`${total} ${total === 1 ? "clause" : "clauses"} flagged: ${tallySentence(audit.flags)}`}
            >
              {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
                <div key={s} className={cn("h-full", SEGMENT[s])} style={{ flexGrow: counts[s] }} />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
              {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", SEGMENT[s])} aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-ink">{counts[s]}</span> {SEVERITY_COPY[s].short}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {audit.summary && (
          <p className="mt-6 max-w-prose border-t border-line pt-6 leading-relaxed text-ink">{audit.summary}</p>
        )}
      </div>

      {!audit.model && (
        <div className="border-t border-honey/25 bg-honey-soft px-6 py-4 text-sm text-honey sm:px-8">
          <span className="font-semibold">This is Nestor's pre-written example review, not a live AI reading.</span>{" "}
          It is shown when OpenAI is not connected or today's live sample reviews are used up. Your own PDF is
          only ever reviewed live.
        </div>
      )}
      {audit.model && audit.isSample && (
        <div className="border-t border-honey/25 bg-honey-soft px-6 py-4 text-sm text-honey sm:px-8">
          <span className="font-semibold">This lease is made up.</span> Nestor wrote it with several traps in it
          so you can see a real review. Upload your own lease to check the one you are about to sign.
        </div>
      )}
    </Card>
  );
}

function AskEmail({
  audit,
  included,
  signature,
  onSelectAll,
  onClear,
}: {
  audit: Audit;
  included: Set<number>;
  signature: string | undefined;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const chosen = useMemo(() => audit.flags.filter((_, i) => included.has(i)), [audit.flags, included]);
  const body = useMemo(() => composeAskEmail(chosen, signature), [chosen, signature]);
  const mailto = `mailto:?subject=${encodeURIComponent(ASK_EMAIL_SUBJECT)}&body=${encodeURIComponent(body)}`;
  // Mail apps silently truncate very long mailto links; past this, copying is the reliable path.
  const mailtoFits = mailto.length <= 1900;

  return (
    <Card className="animate-rise p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest sm:flex">
          <Mail className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl text-ink">One email with everything you want changed</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Each flag below comes with a polite request in your voice. Tick the ones you care about and send
            them together from your own inbox. Nestor does not send this one for you.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-medium text-ink">
              {chosen.length} of {audit.flags.length} {audit.flags.length === 1 ? "ask" : "asks"} included
            </span>
            <button
              type="button"
              onClick={onSelectAll}
              className="cursor-pointer text-forest underline-offset-2 hover:underline"
            >
              Include all
            </button>
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer text-forest underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>

          {chosen.length > 0 ? (
            <>
              <details className="group mt-4 rounded-xl border border-line bg-paper">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink marker:hidden">
                  <span className="group-open:hidden">Preview the email</span>
                  <span className="hidden group-open:inline">Hide the preview</span>
                </summary>
                <div className="border-t border-line px-4 py-4">
                  <p className="text-xs text-ink-faint">Subject</p>
                  <p className="text-sm font-medium text-ink">{ASK_EMAIL_SUBJECT}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{body}</p>
                </div>
              </details>
              <div className="mt-4 flex flex-wrap gap-2">
                <CopyButton
                  text={`Subject: ${ASK_EMAIL_SUBJECT}\n\n${body}`}
                  label="Copy the email"
                  copiedLabel="Copied to clipboard"
                  variant="primary"
                  size="md"
                />
                {mailtoFits && (
                  <a
                    href={mailto}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-card px-4 text-sm font-medium text-ink transition-colors hover:border-forest hover:text-forest"
                  >
                    Open in my email app
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-faint">Tick at least one ask below to build the email.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function Done({ audit, signature }: { audit: Audit; signature: string | undefined }) {
  // Start with the clauses worth a fight; "good to know" items are opt-in.
  const [included, setIncluded] = useState<Set<number>>(() => {
    const strong = audit.flags.flatMap((flag, i) => (flag.severity === "low" ? [] : [i]));
    return new Set(strong.length > 0 ? strong : audit.flags.map((_, i) => i));
  });

  if (audit.flags.length === 0) {
    return (
      <div className="space-y-5">
        <Verdict audit={audit} />
        <Callout
          tone="forest"
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          title="Nothing unusual stood out"
        >
          Nestor found no clause worth flagging. Still read the rent, dates, deposit and notice periods yourself
          before you sign: a clean review is not a guarantee.
        </Callout>
        <LegalNote />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Verdict audit={audit} />
      <AskEmail
        audit={audit}
        included={included}
        signature={signature}
        onSelectAll={() => setIncluded(new Set(audit.flags.map((_, i) => i)))}
        onClear={() => setIncluded(new Set())}
      />

      {SEVERITIES.map((severity) => {
        const rows = audit.flags.map((flag, index) => ({ flag, index })).filter((r) => r.flag.severity === severity);
        if (rows.length === 0) return null;
        return (
          <section key={severity} aria-labelledby={`severity-${severity}`} className="pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
              <h3 id={`severity-${severity}`} className="text-xl text-ink">
                {SEVERITY_COPY[severity].heading}
                <span className="ml-2 font-sans text-sm font-medium text-ink-faint">{rows.length}</span>
              </h3>
              <p className="text-sm text-ink-soft">{SEVERITY_COPY[severity].blurb}</p>
            </div>
            <div className="mt-4 space-y-4">
              {rows.map(({ flag, index }) => (
                <FlagCard
                  key={index}
                  flag={flag}
                  inputId={`include-${audit._id}-${index}`}
                  included={included.has(index)}
                  onToggle={(next) =>
                    setIncluded((current) => {
                      const copy = new Set(current);
                      if (next) copy.add(index);
                      else copy.delete(index);
                      return copy;
                    })
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      <LegalNote />
    </div>
  );
}

export function LegalNote() {
  return (
    <Callout tone="neutral" icon={<Scale className="size-4" aria-hidden="true" />} title="Not legal advice">
      Nestor is an AI assistant, not a lawyer. It can miss things and it can be wrong, and tenant law differs
      from state to state and city to city. Use this to know what to ask about. For anything that worries
      you, talk to a local tenant union, legal aid office or attorney before you sign.
    </Callout>
  );
}

export function AuditResult({
  audit,
  listing,
  signature,
  now,
  onRemoved,
  onUploadAgain,
}: {
  audit: Audit;
  listing: { _id: Id<"listings">; label: string } | null;
  signature: string | undefined;
  now: number;
  onRemoved: () => void;
  onUploadAgain: () => void;
}) {
  return (
    <div className="space-y-5">
      <Header key={`header-${audit._id}`} audit={audit} listing={listing} now={now} onRemoved={onRemoved} />
      {audit.status === "failed" ? (
        <Failed audit={audit} onUploadAgain={onUploadAgain} />
      ) : audit.status === "done" ? (
        <Done key={`done-${audit._id}`} audit={audit} signature={signature} />
      ) : (
        <AuditProgress audit={audit} />
      )}
    </div>
  );
}
