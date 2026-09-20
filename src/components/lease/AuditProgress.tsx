import { Check } from "@/components/icons";
import { Badge, Card } from "@/components/ui";
import { CHECKLIST, elapsedLabel, useNow, type Audit } from "./leaseHelpers";

/*
 * The review is one long model call with no real progress to report, so this
 * shows elapsed time and an honest expectation instead of a made-up percentage.
 */
export function AuditProgress({ audit }: { audit: Audit }) {
  const now = useNow(1000);
  const elapsed = now - audit._creationTime;

  return (
    <Card className="animate-rise overflow-hidden">
      <style>{`
        @keyframes lease-scan {
          0% { transform: translateY(-10%); }
          100% { transform: translateY(1100%); }
        }
      `}</style>
      <div className="grid gap-8 p-6 sm:grid-cols-[11rem_1fr] sm:p-8">
        <div
          className="relative mx-auto h-56 w-44 overflow-hidden rounded-lg border border-line bg-paper shadow-card"
          aria-hidden="true"
        >
          <div className="space-y-2.5 p-4">
            <div className="h-2.5 w-3/5 rounded-full bg-line-strong/70" />
            {[92, 84, 96, 70, 88, 94, 62, 90, 80, 95, 74, 86].map((width, i) => (
              <div key={i} className="h-1.5 rounded-full bg-line" style={{ width: `${width}%` }} />
            ))}
          </div>
          <div
            className="absolute inset-x-0 top-0 h-5 bg-forest/15 motion-reduce:hidden"
            style={{ animation: "lease-scan 2.8s ease-in-out infinite alternate" }}
          />
        </div>

        <div className="min-w-0" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sky" dot pulse>
              Reading
            </Badge>
            {audit.isSample && <Badge tone="honey">Sample</Badge>}
            <span className="text-sm tabular-nums text-ink-faint">{elapsedLabel(elapsed)}</span>
          </div>
          <h2 className="mt-3 text-2xl text-ink">Nestor is reading the fine print</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {audit.isSample
              ? "The sample usually takes under a minute."
              : "A real lease usually takes two to five minutes, longer for a long scan."}{" "}
            You can leave this page: the result will be waiting here, and Nestor will post it to your
            dashboard feed.
          </p>
        </div>
      </div>

      <div className="border-t border-line bg-paper-deep/40 px-6 py-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">What it is looking for</p>
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
  );
}
