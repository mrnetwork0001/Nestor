import { useState } from "react";
import { House } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * A listing photo that degrades to a quiet placeholder. Scraped image links
 * expire and hotlink-protect often, so a broken image is a normal state here.
 */
export function ListingPhoto({
  src,
  alt,
  className,
  iconClassName,
}: {
  src: string | undefined | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = typeof src === "string" && /^https?:\/\//i.test(src) && failedSrc !== src;

  if (!usable) {
    return (
      <div
        className={cn("paper-grain flex items-center justify-center bg-paper-deep text-line-strong", className)}
        role={alt ? "img" : undefined}
        aria-label={alt ? `No photo for ${alt}` : undefined}
        aria-hidden={alt ? undefined : true}
      >
        <House className={cn("size-7", iconClassName)} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn("bg-paper-deep object-cover", className)}
    />
  );
}
