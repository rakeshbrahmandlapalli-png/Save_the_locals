"use client";

import { useState } from "react";
import { CategoryIcon } from "@/lib/category-icons";
import type { Accent } from "@/lib/collections";

/**
 * Product photo in a fixed-ratio tile. Cropped pack shots (local /products/ assets) are contained so
 * packaging is never clipped; photos fill the tile. When there is no accurate photo, or it fails to
 * load, the tile shows the aisle's icon on its accent tint: one consistent, deliberate fallback.
 */
export function ProductImage({
  src,
  alt,
  accent = "sage",
  icon = null,
  className = "",
  iconClassName = "h-9 w-9",
}: {
  src: string | null;
  alt: string;
  accent?: Accent;
  icon?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const packShot = Boolean(src?.startsWith("/products/"));
  return (
    <div className={`accent-${accent} relative overflow-hidden ${showImage ? "bg-[var(--tile)]" : "bg-accent-tint"} ${className}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-full ${packShot ? "object-contain" : "object-cover"}`}
        />
      ) : (
        <div role="img" aria-label={alt} className="text-accent flex h-full w-full items-center justify-center">
          <CategoryIcon icon={icon} className={`${iconClassName} opacity-80 [stroke-width:1.5]`} />
        </div>
      )}
    </div>
  );
}
