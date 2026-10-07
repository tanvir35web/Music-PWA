"use client";

import Image from "next/image";
import { Music } from "lucide-react";
import { useObjectUrl } from "@/hooks/use-object-url";
import { cn } from "@/lib/utils/cn";

interface CoverArtProps {
  blob?: Blob;
  /** Seeds the placeholder colour so each track keeps a stable look. */
  seed: string;
  /** Intrinsic size in CSS pixels. */
  size: number;
  /** Let className control the rendered size instead of `size`. */
  fluid?: boolean;
  className?: string;
  priority?: boolean;
}

function hueFrom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

/** Decorative artwork: the track title is always shown next to it. */
export function CoverArt({ blob, seed, size, fluid, className, priority }: CoverArtProps) {
  const url = useObjectUrl(blob);
  const hue = hueFrom(seed);
  return (
    <div
      aria-hidden
      className={cn("relative shrink-0 overflow-hidden bg-surface-2", className)}
      style={{
        width: fluid ? undefined : size,
        height: fluid ? undefined : size,
        backgroundImage: url
          ? undefined
          : `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 50) % 360} 70% 40%))`,
      }}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          width={size}
          height={size}
          unoptimized
          priority={priority}
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-white/90">
          <Music className="size-2/5" />
        </div>
      )}
    </div>
  );
}
