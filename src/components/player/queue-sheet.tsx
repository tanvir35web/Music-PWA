"use client";

import { Sheet } from "@/components/ui/sheet";
import { CoverArt } from "@/components/ui/cover-art";
import { useLibrary } from "@/hooks/use-library";
import { player, usePlayerState } from "@/hooks/use-player";
import { cn } from "@/lib/utils/cn";

const MAX_SHOWN = 200;

export default function QueueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { queue, queueIndex } = usePlayerState();
  const { byId } = useLibrary();
  const upcoming = queue.slice(Math.max(queueIndex, 0), Math.max(queueIndex, 0) + MAX_SHOWN);

  return (
    <Sheet open={open} onClose={onClose} title="Up Next">
      {upcoming.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">The queue is empty.</p>
      ) : (
        <ol className="flex flex-col">
          {upcoming.map((id, offset) => {
            const track = byId.get(id);
            if (!track) return null;
            const index = Math.max(queueIndex, 0) + offset;
            const current = index === queueIndex;
            return (
              <li key={`${id}-${index}`}>
                <button
                  type="button"
                  onClick={() => player.playAt(index)}
                  aria-current={current ? "true" : undefined}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 text-left active:bg-surface-2"
                >
                  <CoverArt blob={track.coverArt} seed={track.id} size={40} className="rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[15px]", current && "font-semibold text-accent")}>
                      {track.title}
                    </span>
                    <span className="block truncate text-sm text-muted">{track.artist ?? "Unknown artist"}</span>
                  </span>
                  {current && <span className="text-xs font-medium text-accent">Playing</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Sheet>
  );
}
