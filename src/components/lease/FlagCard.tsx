import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RISK_TONE } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import type { Flag, Severity } from "./leaseHelpers";

const SEVERITY_BADGE: Record<Severity, string> = {
  high: "Serious",
  medium: "Negotiate",
  low: "Good to know",
};

const SEVERITY_EDGE: Record<Severity, string> = {
  high: "border-l-clay",
  medium: "border-l-honey",
  low: "border-l-moss",
};

function Eyebrow({ children }: { children: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{children}</p>;
}

export function FlagCard({
  flag,
  inputId,
  included,
  onToggle,
}: {
  flag: Flag;
  inputId: string;
  included: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <article
      className={cn(
        "animate-rise rounded-card border border-l-4 border-line bg-card shadow-card",
        SEVERITY_EDGE[flag.severity],
      )}
    >
      <div className="space-y-5 p-5 sm:p-6">
        <header>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Badge tone={RISK_TONE[flag.severity]} dot>
              {SEVERITY_BADGE[flag.severity]}
            </Badge>
            <span className="text-xs font-medium text-ink-soft">{flag.category}</span>
            {flag.pageHint && <span className="text-xs text-ink-faint">{flag.pageHint}</span>}
          </div>
          <h4 className="mt-2.5 font-display text-xl leading-snug tracking-[-0.01em] text-ink">{flag.title}</h4>
        </header>

        <div>
          <Eyebrow>The lease says</Eyebrow>
          <blockquote className="mt-2 border-l-2 border-line-strong pl-4 font-display text-[15px] italic leading-relaxed text-ink-soft">
            &ldquo;{flag.clauseQuote}&rdquo;
          </blockquote>
        </div>

        <div>
          <Eyebrow>Why it matters</Eyebrow>
          <p className="mt-2 text-sm leading-relaxed text-ink">{flag.whyItMatters}</p>
        </div>

        <div className="rounded-xl border border-forest/15 bg-forest-soft/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-deep">
              What to ask for
            </p>
            <CopyButton text={flag.suggestedAsk} label="Copy" className="shrink-0" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink">{flag.suggestedAsk}</p>
          <label
            htmlFor={inputId}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft"
          >
            <input
              id={inputId}
              type="checkbox"
              checked={included}
              onChange={(event) => onToggle(event.target.checked)}
              className="size-4 cursor-pointer accent-forest"
            />
            Include in my email to the landlord
          </label>
        </div>
      </div>
    </article>
  );
}
