import { asset } from "@/lib/site";
import type { TaskImageInfo } from "@/lib/types";

/** The task's showcase image, or a clean text panel when the task has none. */
export default function TaskImage({ image, title, area, variant = "hero" }: { image?: TaskImageInfo | null; title: string; area?: string | null; variant?: "hero" | "thumb" }) {
  const hero = variant === "hero";
  if (!image) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted to-card text-center ${
          hero ? "aspect-[3/2] w-full p-8" : "aspect-[3/2] w-full p-3"
        }`}
        aria-label="No image for this task"
      >
        <div>
          {area && <div className={`uppercase tracking-wide text-muted-foreground ${hero ? "text-xs" : "text-[9px]"}`}>{area.split(" / ")[0]}</div>}
          <div className={`mt-1 font-semibold leading-snug text-foreground/80 ${hero ? "text-xl" : "text-[11px]"}`}>{title}</div>
        </div>
      </div>
    );
  }
  return (
    <figure className="w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(image.src)}
        alt={image.caption ?? title}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={hero ? "eager" : "lazy"}
        className={`w-full rounded-xl border border-border object-cover ${hero ? "" : "aspect-[3/2]"}`}
      />
      {hero && image.caption && <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{image.caption}</figcaption>}
    </figure>
  );
}
