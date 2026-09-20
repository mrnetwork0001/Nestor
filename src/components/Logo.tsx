import { Link } from "react-router";
import { cn } from "@/lib/cn";

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" className="size-8" aria-hidden="true">
        <rect width="64" height="64" rx="16" className="fill-forest" />
        <path
          d="M14 31.5 32 16l18 15.5M20 29v19h24V29"
          fill="none"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-paper"
        />
        <circle cx="32" cy="38" r="4" className="fill-clay" />
      </svg>
      <span className="font-display text-2xl tracking-tight text-ink">Nestor</span>
    </Link>
  );
}
