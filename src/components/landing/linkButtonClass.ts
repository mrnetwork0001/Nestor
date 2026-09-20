import { cn } from "@/lib/cn";

/*
 * The Button primitive's look as a class string, for things that must not be a
 * <button>: router links, plain anchors, and the drawn controls inside the
 * landing page's product fragments. Mirrors Button in components/ui.tsx.
 */

export type LinkButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "inverse";
export type LinkButtonSize = "sm" | "md" | "lg";

const variants: Record<LinkButtonVariant, string> = {
  primary: "bg-forest text-paper hover:bg-forest-deep shadow-sm",
  accent: "bg-clay text-paper hover:bg-clay-deep shadow-sm",
  secondary: "bg-card text-ink border border-line-strong hover:border-forest hover:text-forest",
  ghost: "text-ink-soft hover:bg-paper-deep hover:text-ink",
  // For dark bands: a paper button on forest.
  inverse: "bg-paper text-forest-deep hover:bg-card shadow-sm",
};

const sizes: Record<LinkButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export function linkButtonClass(
  variant: LinkButtonVariant = "primary",
  size: LinkButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors",
    variants[variant],
    sizes[size],
    className,
  );
}
