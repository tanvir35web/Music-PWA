"use client";

import { useCallback, useMemo } from "react";
import type { Track } from "@/types/track";
import { player, usePlayerState } from "@/hooks/use-player";
import { VirtualList } from "./virtual-list";
import { TRACK_ROW_HEIGHT, TrackRow } from "./track-row";
import { openTrackMenu, type TrackMenuContext } from "./track-menu";

interface TrackListProps {
  tracks: readonly Track[];
  label: string;
  /** Where the list lives, so the menu can offer e.g. "Remove from playlist". */
  context?: TrackMenuContext;
}

/** Plays the visible list as the queue when a row is tapped. */
export function TrackList({ tracks, label, context }: TrackListProps) {
  const { currentTrackId, isPlaying } = usePlayerState();
  const ids = useMemo(() => tracks.map((t) => t.id), [tracks]);

  const onPlay = useCallback((index: number) => player.playQueue(ids, { startIndex: index }), [ids]);
  const onMenu = useCallback((track: Track) => openTrackMenu(track.id, context), [context]);

  return (
    <VirtualList
      items={tracks}
      label={label}
      rowHeight={TRACK_ROW_HEIGHT}
      getKey={(track) => track.id}
      renderRow={(track, index) => (
        <TrackRow
          track={track}
          index={index}
          isCurrent={track.id === currentTrackId}
          isPlaying={isPlaying && track.id === currentTrackId}
          onPlay={onPlay}
          onMenu={onMenu}
        />
      )}
    />
  );
}
