import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Nestor's UI primitives. Pages compose these instead of restyling raw
 * elements, so the whole app keeps one look.
 */

// Button ---------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-forest text-paper hover:bg-forest-deep shadow-sm disabled:bg-moss/60",
  accent: "bg-clay text-paper hover:bg-clay-deep shadow-sm disabled:bg-clay/50",
  secondary:
    "bg-card text-ink border border-line-strong hover:border-forest hover:text-forest disabled:opacity-50",
  ghost: "text-ink-soft hover:bg-paper-deep hover:text-ink disabled:opacity-50",
  danger:
    "bg-card text-clay-deep border border-clay/40 hover:bg-clay-soft disabled:opacity-50",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed",
          buttonVariants[variant],
          buttonSizes[size],
          className,
        )}
        {...rest}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  },
);

// Surfaces -------------------------------------------------------------------

export function Card({
  className,
  interactive = false,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "bg-card border border-line rounded-card shadow-card",
        interactive &&
          "transition-all hover:shadow-lift hover:-translate-y-0.5 hover:border-line-strong",
        className,
      )}
      {...rest}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** The one page header used by every screen inside the app shell. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("max-w-2xl", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">{eyebrow}</p>
      <h1 className="mt-1 text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
      {lede && <p className="mt-2 text-ink-soft">{lede}</p>}
    </header>
  );
}

// Badges ---------------------------------------------------------------------

export type Tone = "neutral" | "forest" | "clay" | "honey" | "sky";

const tones: Record<Tone, string> = {
  neutral: "bg-paper-deep text-ink-soft border-line",
  forest: "bg-forest-soft text-forest-deep border-forest/15",
  clay: "bg-clay-soft text-clay-deep border-clay/20",
  honey: "bg-honey-soft text-honey border-honey/25",
  sky: "bg-sky-soft text-sky border-sky/20",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            pulse && "animate-pulse-dot",
          )}
        />
      )}
      {children}
    </span>
  );
}

// Forms ----------------------------------------------------------------------

const fieldBase =
  "w-full rounded-xl border border-line-strong bg-card px-3.5 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-moss focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        // The id lets an input point aria-describedby at its error text.
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-clay-deep">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "py-2.5 leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn(fieldBase, "h-10 pr-8", className)} {...rest} />;
});

/** A pill that toggles on and off. Used for goals, must-haves, neighbourhoods. */
export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
        selected
          ? "border-forest bg-forest text-paper"
          : "border-line-strong bg-card text-ink-soft hover:border-forest hover:text-forest",
      )}
    >
      {children}
    </button>
  );
}

// Feedback -------------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-moss", className)} />;
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-faint">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-line-strong bg-paper-deep/40 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-forest-soft text-forest">
          {icon}
        </div>
      )}
      <h3 className="text-lg text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-paper-deep", className)} />;
}

/** Inline notice. Use tone="honey" for sample-data and demo-mode disclosures. */
export function Callout({
  tone = "honey",
  icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  );
}
