"use client";

import { useState } from "react";
import { Package } from "lucide-react";

/**
 * Product photo on a light neutral tile. Falls back to a neutral placeholder when there is no
 * image or it fails to load, so a broken URL never leaves an empty box or alt text showing.
 */
export function ProductImage({ src, alt, className = "", iconClassName = "h-8 w-8" }: { src: string | null; alt: string; className?: string; iconClassName?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div className={`relative overflow-hidden bg-[#f1efe9] ${className}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src as string} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div role="img" aria-label={alt} className="flex h-full w-full items-center justify-center text-stone-400">
          <Package className={iconClassName} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
