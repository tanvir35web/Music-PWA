"use client";

import { memo, useCallback } from "react";
import { Ellipsis, Heart } from "lucide-react";
import type { Track } from "@/types/track";
import { CoverArt } from "@/components/ui/cover-art";
import { IconButton } from "@/components/ui/button";
import { useLongPress } from "@/hooks/use-long-press";
import { cn } from "@/lib/utils/cn";
import { describeDuration, formatDuration } from "@/lib/utils/format";

export const TRACK_ROW_HEIGHT = 64;

interface TrackRowProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: (index: number) => void;
  onMenu: (track: Track) => void;
}

function NowPlayingBars() {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span key={i} className="eq-bar block h-full w-[3px] rounded-sm bg-accent" />
      ))}
    </span>
  );
}

export const TrackRow = memo(function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onMenu,
}: TrackRowProps) {
  const openMenu = useCallback(() => onMenu(track), [onMenu, track]);
  const { handlers, consumeClick } = useLongPress(openMenu);
  const subtitle = [track.artist, track.album].filter(Boolean).join(" · ") || "Unknown artist";

  return (
    <div className="flex h-full items-center gap-1 pl-safe px-2">
      <button
        type="button"
        className="no-callout flex h-full min-w-0 flex-1 items-center gap-3 rounded-xl text-left active:bg-surface-2"
        aria-label={`Play ${track.title}${track.artist ? ` by ${track.artist}` : ""}, ${describeDuration(track.duration)}`}
        aria-current={isCurrent ? "true" : undefined}
        onClick={() => {
          if (!consumeClick()) onPlay(index);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openMenu();
        }}
        {...handlers}
      >
        <CoverArt blob={track.coverArt} seed={track.id} size={48} className="rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className={cn("flex items-center gap-2 truncate text-[15px] font-medium", isCurrent && "text-accent")}>
            {isCurrent && isPlaying && <NowPlayingBars />}
            <span className="truncate">{track.title}</span>
          </span>
          <span className="block truncate text-sm text-muted">{subtitle}</span>
        </span>
        {track.isFavorite && <Heart aria-label="Favourite" className="size-4 shrink-0 fill-accent text-accent" />}
        <span aria-hidden className="w-12 shrink-0 text-right text-sm tabular-nums text-muted">
          {formatDuration(track.duration)}
        </span>
      </button>
      <IconButton label={`More options for ${track.title}`} onClick={openMenu} className="text-muted">
        <Ellipsis className="size-5" aria-hidden />
      </IconButton>
    </div>
  );
});
