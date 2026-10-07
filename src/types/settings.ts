import type { RepeatMode } from "./player";

export type ThemePreference = "system" | "light" | "dark";

export interface AppSettings {
  theme: ThemePreference;
  /** Continue to the next track when one finishes. */
  autoplay: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
  volume: number;
  playbackRate: number;
  lastTrackId: string | null;
  lastPosition: number;
  lastQueue: string[];
  /**
   * iOS shows either skip-track or seek buttons on the lock screen. When true
   * the seek handlers are not registered so track buttons are shown.
   */
  preferTrackButtons: boolean;
}
