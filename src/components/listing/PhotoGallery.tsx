import { useState } from "react";
import { cn } from "@/lib/cn";
import { ListingPhoto } from "./ListingPhoto";

const MAX_PHOTOS = 8;

/** One large photo with a strip of thumbnails. Works with zero photos and with broken links. */
export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const usable = photos.filter((src) => /^https?:\/\//i.test(src)).slice(0, MAX_PHOTOS);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(usable.length - 1, 0));

  return (
    <div className="space-y-2">
      <ListingPhoto
        key={usable[index] ?? "none"}
        src={usable[index]}
        alt={usable.length > 1 ? `${alt}, photo ${index + 1} of ${usable.length}` : alt}
        className="aspect-[16/10] w-full animate-rise rounded-card border border-line"
        iconClassName="size-10"
      />
      {usable.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Listing photos">
          {usable.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === index}
              className={cn(
                "shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-opacity",
                i === index ? "border-forest" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <ListingPhoto src={src} alt="" className="h-14 w-20" iconClassName="size-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
