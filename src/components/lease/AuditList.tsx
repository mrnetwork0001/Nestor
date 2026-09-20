import { FileText } from "@/components/icons";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RISK_TONE, timeAgo } from "@/lib/format";
import type { Audit } from "./leaseHelpers";

const RISK_LABEL: Record<string, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};

function StatusBadge({ audit }: { audit: Audit }) {
  if (audit.status === "failed") return <Badge tone="clay">Could not check</Badge>;
  if (audit.status === "done" && audit.overallRisk) {
    return <Badge tone={RISK_TONE[audit.overallRisk]}>{RISK_LABEL[audit.overallRisk]}</Badge>;
  }
  if (audit.status === "done") return <Badge tone="forest">Checked</Badge>;
  return (
    <Badge tone="sky" dot pulse>
      Reading
    </Badge>
  );
}

function detailLine(audit: Audit, now: number): string {
  const when = timeAgo(audit._creationTime, now);
  if (audit.status === "done") {
    const n = audit.flags.length;
    return `${n === 0 ? "Nothing unusual" : `${n} ${n === 1 ? "clause" : "clauses"} flagged`} · ${when}`;
  }
  if (audit.status === "failed") return `Stopped · ${when}`;
  return `Started ${when}`;
}

export function AuditList({
  audits,
  selectedId,
  now,
  onSelect,
}: {
  audits: Audit[];
  selectedId: Id<"leaseAudits"> | null;
  now: number;
  onSelect: (auditId: Id<"leaseAudits">) => void;
}) {
  return (
    <ul className="space-y-2">
      {audits.map((audit) => {
        const selected = audit._id === selectedId;
        return (
          <li key={audit._id} className="animate-rise">
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(audit._id)}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors",
                selected
                  ? "border-forest shadow-card"
                  : "border-line hover:border-line-strong hover:bg-paper-deep/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                  selected ? "bg-forest text-paper" : "bg-paper-deep text-ink-soft",
                )}
              >
                <FileText className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink" title={audit.fileName}>
                  {audit.fileName}
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">{detailLine(audit, now)}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge audit={audit} />
                  {audit.isSample && <Badge tone="honey">Sample</Badge>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
