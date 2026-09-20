import { Link } from "react-router";
import lockup from "@/assets/lockup.png";
import mark from "@/assets/mark.png";
import wordmark from "@/assets/wordmark.png";
import { cn } from "@/lib/cn";

/*
 * Three cuts of the same artwork:
 *   wordmark  icon + "Nestor". The default: the tagline is unreadable below about 80px tall.
 *   lockup    icon + "Nestor" + tagline. For places with room, like the landing footer.
 *   mark      the icon alone. For the collapsed sidebar.
 * `size` is a height class for the artwork (the width follows); `className` lays out the link.
 */
const ART = {
  wordmark: { src: wordmark, width: 529, height: 168 },
  lockup: { src: lockup, width: 906, height: 288 },
  mark: { src: mark, width: 115, height: 168 },
} as const;

export function Logo({
  to = "/",
  variant = "wordmark",
  size = "h-9",
  className,
}: {
  to?: string;
  variant?: keyof typeof ART;
  size?: string;
  className?: string;
}) {
  const art = ART[variant];
  return (
    <Link to={to} aria-label="Nestor home" className={cn("inline-flex shrink-0 items-center", className)}>
      <img
        src={art.src}
        width={art.width}
        height={art.height}
        alt="Nestor"
        decoding="async"
        className={cn("w-auto select-none", size)}
        draggable={false}
      />
    </Link>
  );
}
