import { cn } from "@/lib/cn";

const SIZES = {
  sm: { box: "size-10", text: "text-xs", stroke: 3.5 },
  lg: { box: "size-16", text: "text-lg", stroke: 3 },
} as const;

function ringClass(score: number): string {
  if (score >= 75) return "stroke-forest";
  if (score >= 50) return "stroke-honey";
  return "stroke-clay";
}

export function matchWord(score: number): string {
  if (score >= 85) return "Great match";
  if (score >= 70) return "Good match";
  if (score >= 50) return "Partial match";
  return "Weak match";
}

/** How well a listing fits the renter, 0-100, as a small ring. The number stays in ink; the ring carries the colour. */
export function MatchScore({
  score,
  size = "sm",
  className,
}: {
  score: number | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (score === undefined) return null;
  const { box, text, stroke } = SIZES[size];
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn("relative shrink-0 rounded-full bg-card", box, className)}
      role="img"
      aria-label={`${matchWord(clamped)}: ${clamped} out of 100`}
      title={`${matchWord(clamped)}: ${clamped} out of 100`}
    >
      <svg viewBox="0 0 40 40" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", ringClass(clamped))}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-ink",
          text,
        )}
        aria-hidden="true"
      >
        {clamped}
      </span>
    </div>
  );
}
