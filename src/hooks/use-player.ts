"use client";

import { useSyncExternalStore } from "react";
import type { PlaybackProgress, PlayerState } from "@/types/player";
import type { Track } from "@/types/track";
import { getPlayer } from "@/lib/audio/player";
import { useLibrary } from "./use-library";

const SERVER_STATE: PlayerState = {
  currentTrackId: null,
  isPlaying: false,
  isLoading: false,
  volume: 1,
  playbackRate: 1,
  repeatMode: "off",
  shuffle: false,
  queue: [],
  queueIndex: -1,
  error: null,
};
const SERVER_PROGRESS: PlaybackProgress = { currentTime: 0, duration: 0 };

const subscribe = (listener: () => void) => getPlayer().subscribe(listener);
const getState = () => getPlayer().getState();
const subscribeProgress = (listener: () => void) => getPlayer().subscribeProgress(listener);
const getProgress = () => getPlayer().getProgress();

/** Player state that changes on play/pause/track changes (not on every tick). */
export function usePlayerState(): PlayerState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
}

/**
 * Current time and duration. Updates about four times per second while
 * playing, so only components that display progress should use it.
 */
export function usePlaybackProgress(): PlaybackProgress {
  return useSyncExternalStore(subscribeProgress, getProgress, () => SERVER_PROGRESS);
}

/** Player controls. Call from event handlers only (never during render). */
export const player = {
  playQueue: (ids: readonly string[], options?: { startIndex?: number; shuffle?: boolean }) =>
    getPlayer().playQueue(ids, options),
  playAt: (index: number) => getPlayer().playAt(index),
  togglePlay: () => getPlayer().togglePlay(),
  next: () => getPlayer().next(),
  previous: () => getPlayer().previous(),
  seek: (seconds: number) => getPlayer().seek(seconds),
  seekBy: (seconds: number) => getPlayer().seekBy(seconds),
  cycleRepeatMode: () => getPlayer().cycleRepeatMode(),
  toggleShuffle: () => getPlayer().toggleShuffle(),
  setVolume: (volume: number) => getPlayer().setVolume(volume),
  setPlaybackRate: (rate: number) => getPlayer().setPlaybackRate(rate),
  addToQueue: (ids: readonly string[]) => getPlayer().addToQueue(ids),
  playNext: (id: string) => getPlayer().playNext(id),
  clearError: () => getPlayer().clearError(),
};

export function useCurrentTrack(): Track | undefined {
  const { currentTrackId } = usePlayerState();
  const { byId } = useLibrary();
  return currentTrackId ? byId.get(currentTrackId) : undefined;
}
