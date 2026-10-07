export type RepeatMode = "off" | "one" | "all";

export interface PlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  /** True while a track is being loaded from IndexedDB or buffering. */
  isLoading: boolean;
  volume: number;
  playbackRate: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  /** Track ids in play order (shuffled order when shuffle is on). */
  queue: string[];
  queueIndex: number;
  /** User-facing message for the last playback failure. */
  error: string | null;
}

export interface PlaybackProgress {
  currentTime: number;
  duration: number;
}
