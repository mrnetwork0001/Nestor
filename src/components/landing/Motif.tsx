import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * The small hand-set details that make the landing page Nestor's own: a
 * hairline rule that lifts into the doorway from the logo mark, the key with
 * a doorway bow that ends the page, and the small-caps eyebrow used above every heading.
 */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-[0.18em] text-moss", className)}>
      {children}
    </p>
  );
}

/** A hairline that lifts into the mark's silhouette: slanted roofline, rounded shoulder, and the opening's slanted quarter-arch in clay. Decorative. */
export function RooflineRule({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-end text-line-strong", className)}>
      <span className="h-px flex-1 bg-current" />
      <svg viewBox="0 0 48 24" className="h-6 w-12 shrink-0" fill="none">
        <path d="M19.5 23.5V9.5l5.5 4c1.6 1.2 2.5 2.2 2.5 4.2v5.8Z" className="fill-clay" />
        <path
          d="M0 23.5h14.5V8L25 1.5l6.6 3.2c1.3.7 1.9 1.5 1.9 2.8v16H48M19.5 23.5V9.5l5.5 4c1.6 1.2 2.5 2.2 2.5 4.2v5.8"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}

/**
 * A key whose bow is the logo mark itself, solid, with the opening in clay.
 * Bow, shaft and bits are one filled path so a translucent currentColor
 * (text-paper/40 on forest) never doubles up where they meet. Decorative.
 */
export function KeyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 48" className={className} fill="none" aria-hidden="true">
      <path d="M10.5 41.8V10.6l9.5 6c2.2 1.5 3.3 2.8 3.3 5.6v19.3Z" className="fill-clay" />
      <path
        d="M4 45.7V11.8L19.8 2l10.4 5c1.9 1 2.8 2.1 2.8 3.9v13.6h75.5a1.5 1.5 0 0 1 0 3H106v6a1.5 1.5 0 0 1-3 0v-6h-6v9a1.5 1.5 0 0 1-3 0v-9H33V46l-9.7-4.5V22.2c0-2.8-1.1-4.1-3.3-5.6l-9.5-6v31.2Z"
        fill="currentColor"
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
