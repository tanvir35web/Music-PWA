"use client";

import type { Track } from "@/types/track";
import { CoverArt } from "@/components/ui/cover-art";
import { player } from "@/hooks/use-player";

/** Horizontal strip of recently played songs. */
export function RecentlyPlayed({ tracks }: { tracks: Track[] }) {
  const ids = tracks.map((t) => t.id);
  return (
    <section aria-labelledby="recent-heading" className="mt-5">
      <h2 id="recent-heading" className="px-safe text-lg font-semibold">
        Recently Played
      </h2>
      <ul className="px-safe mt-2 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
        {tracks.map((track, index) => (
          <li key={track.id} className="w-28 shrink-0 snap-start">
            <button
              type="button"
              onClick={() => player.playQueue(ids, { startIndex: index })}
              className="w-full text-left"
              aria-label={`Play ${track.title}${track.artist ? ` by ${track.artist}` : ""}`}
            >
              <CoverArt blob={track.coverArt} seed={track.id} size={112} className="rounded-xl" />
              <span className="mt-1.5 block truncate text-sm font-medium">{track.title}</span>
              <span className="block truncate text-xs text-muted">{track.artist ?? "Unknown artist"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
