import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * The small hand-set details that make the landing page Nestor's own: a
 * hairline rule with a gable in the middle (the roof from the logo), the key
 * that ends the page, and the small-caps eyebrow used above every heading.
 */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-[0.18em] text-moss", className)}>
      {children}
    </p>
  );
}

/** A hairline that lifts into a little roof at its centre. Decorative. */
export function RooflineRule({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-end text-line-strong", className)}>
      <span className="h-px flex-1 bg-current" />
      <svg viewBox="0 0 48 14" className="h-3.5 w-12 shrink-0" fill="none">
        <path d="M0 13.5h8L24 1.5l16 12h8" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}

/** The logo's clay dot, grown into a key. Decorative. */
export function KeyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="4.5" className="fill-clay" />
      <path
        d="M39 24h70M92 24v11M103 24v8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Large serif numerals for the numbered steps and commitments. */
export function Numeral({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("font-display text-5xl leading-none text-clay tabular-nums", className)}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** "Fig. 1" captions under the product fragments, as in a printed guide. */
export function FigCaption({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figcaption className="mt-4 flex gap-2 text-xs leading-relaxed text-ink-faint">
      <span className="shrink-0 whitespace-nowrap font-display italic text-ink-soft">{label}</span>
      <span>{children}</span>
    </figcaption>
  );
}
