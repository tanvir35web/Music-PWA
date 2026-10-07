import type { PlaybackProgress, PlayerState, RepeatMode } from "@/types/player";
import { createStore } from "@/lib/utils/store";
import type {
  MediaSessionController,
  MediaSessionHandlers,
  NowPlayingInfo,
} from "./media-session";

/** The subset of HTMLMediaElement the engine relies on (mockable in tests). */
export type MediaElement = Pick<
  HTMLMediaElement,
  | "src"
  | "currentTime"
  | "duration"
  | "paused"
  | "volume"
  | "playbackRate"
  | "defaultPlaybackRate"
  | "play"
  | "pause"
  | "load"
  | "removeAttribute"
  | "addEventListener"
  | "removeEventListener"
>;

export type TrackDescription = NowPlayingInfo & { duration?: number };

export interface AudioEngineDeps {
  media: MediaElement;
  /** Loads the audio Blob for a track (from IndexedDB in the app). */
  loadAudio(trackId: string): Promise<Blob | undefined>;
  describeTrack(trackId: string): TrackDescription | undefined;
  createObjectUrl?(blob: Blob): string;
  revokeObjectUrl?(url: string): void;
  random?(): number;
  createMediaSession?(handlers: MediaSessionHandlers): MediaSessionController;
  /** Silent clip played synchronously inside the first user gesture (iOS). */
  unlockSrc?: string;
}

export interface AudioEngineEvents {
  /** A track actually started playing (used for play counts). */
  trackstart: (trackId: string) => void;
  /** The browser determined a track's duration. */
  duration: (trackId: string, seconds: number) => void;
}

export const PLAYBACK_ERROR =
  "Unable to play this track. The audio file may be corrupted or unsupported.";
export const MISSING_AUDIO_ERROR =
  "This track's audio is missing from this device. Try importing it again.";

/** "Previous" restarts the current track when past this many seconds. */
export const RESTART_THRESHOLD_SECONDS = 3;

const INITIAL_STATE: PlayerState = {
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

const INITIAL_PROGRESS: PlaybackProgress = { currentTime: 0, duration: 0 };

export function shuffleIds(ids: readonly string[], random: () => number = Math.random): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function errorName(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error
    ? String((error as { name: unknown }).name)
    : "";
}

/**
 * Owns the single app-wide media element: queue, shuffle/repeat, Blob URL
 * lifecycle and Media Session. UI code reads state through `subscribe` /
 * `getState` (useSyncExternalStore) and never touches the element directly.
 */
export class AudioEngine {
  private readonly state = createStore<PlayerState>(INITIAL_STATE);
  private readonly progress = createStore<PlaybackProgress>(INITIAL_PROGRESS);
  private readonly media: MediaElement;
  private readonly session: MediaSessionController | null;
  private readonly random: () => number;
  private readonly listeners: { [K in keyof AudioEngineEvents]: Set<AudioEngineEvents[K]> } = {
    trackstart: new Set(),
    duration: new Set(),
  };
  private readonly removeMediaListeners: () => void;

  /** Queue in its original (unshuffled) order. */
  private originalQueue: string[] = [];
  /** Track whose audio is currently set as the element's source. */
  private loadedTrackId: string | null = null;
  private objectUrl: string | null = null;
  /** Incremented per load so stale async loads can be discarded. */
  private loadToken = 0;
  private countedLoadToken = -1;
  private durationReportedToken = -1;
  private pendingSeek: number | null = null;
  /** Position to resume from after restoring the last session. */
  private restorePosition = 0;
  private unlocked = false;
  private autoplayNext = true;

  /** False on iOS, where media volume is controlled only by the hardware. */
  readonly canSetVolume: boolean;

  constructor(private readonly deps: AudioEngineDeps) {
    this.media = deps.media;
    this.random = deps.random ?? Math.random;
    this.canSetVolume = detectVolumeControl(this.media);
    this.session =
      deps.createMediaSession?.({
        play: () => this.play(),
        pause: () => this.pause(),
        previous: () => this.previous(),
        next: () => this.next(),
        seekBy: (seconds) => this.seekBy(seconds),
        seekTo: (seconds) => this.seek(seconds),
      }) ?? null;
    this.removeMediaListeners = this.attachMediaListeners();
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  getState = (): PlayerState => this.state.get();
  subscribe = (listener: () => void): (() => void) => this.state.subscribe(listener);
  getProgress = (): PlaybackProgress => this.progress.get();
  subscribeProgress = (listener: () => void): (() => void) => this.progress.subscribe(listener);

  on<K extends keyof AudioEngineEvents>(event: K, listener: AudioEngineEvents[K]): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  private emit<K extends keyof AudioEngineEvents>(
    event: K,
    ...args: Parameters<AudioEngineEvents[K]>
  ): void {
    for (const listener of this.listeners[event]) {
      try {
        (listener as (...a: Parameters<AudioEngineEvents[K]>) => void)(...args);
      } catch (error) {
        console.error(`AudioEngine ${event} listener failed`, error);
      }
    }
  }

  private update(patch: Partial<PlayerState>): void {
    this.state.set((current) => ({ ...current, ...patch }));
  }

  // -------------------------------------------------------------------------
  // Queue and transport
  // -------------------------------------------------------------------------

  /**
   * Replaces the queue and starts playing. With `shuffle` and no
   * `startIndex`, playback starts from a random track.
   */
  playQueue(trackIds: readonly string[], options: { startIndex?: number; shuffle?: boolean } = {}): void {
    if (trackIds.length === 0) return;
    const shuffle = options.shuffle ?? this.state.get().shuffle;
    const startIndex = Math.min(Math.max(options.startIndex ?? 0, 0), trackIds.length - 1);
    this.originalQueue = [...trackIds];

    let queue = [...trackIds];
    let index = startIndex;
    if (shuffle) {
      if (options.startIndex === undefined) {
        queue = shuffleIds(trackIds, this.random);
      } else {
        const startId = trackIds[startIndex];
        queue = [startId, ...shuffleIds(trackIds.filter((_, i) => i !== startIndex), this.random)];
      }
      index = 0;
    }
    this.update({ queue, queueIndex: index, shuffle });
    this.unlock();
    void this.load(index, { autoplay: true });
  }

  /** Jumps to a position in the current queue, keeping its order. */
  playAt(index: number): void {
    if (index < 0 || index >= this.state.get().queue.length) return;
    this.unlock();
    void this.load(index, { autoplay: true });
  }

  togglePlay(): void {
    if (this.state.get().isPlaying) this.pause();
    else this.play();
  }

  play(): void {
    const { currentTrackId, queueIndex } = this.state.get();
    if (!currentTrackId) return;
    if (this.loadedTrackId !== currentTrackId) {
      const startAt = this.restorePosition;
      this.restorePosition = 0;
      this.unlock();
      void this.load(queueIndex, { autoplay: true, startAt });
      return;
    }
    void this.safePlay();
  }

  pause(): void {
    if (this.loadedTrackId) this.media.pause();
    this.update({ isPlaying: false });
  }

  seek(seconds: number): void {
    const { duration } = this.progress.get();
    const max = duration > 0 ? duration : Number.POSITIVE_INFINITY;
    const target = Math.min(Math.max(seconds, 0), max);
    if (!this.loadedTrackId) {
      this.restorePosition = target;
    } else {
      this.media.currentTime = target;
    }
    this.progress.set({ currentTime: target, duration });
  }

  seekBy(delta: number): void {
    this.seek(this.progress.get().currentTime + delta);
  }

  next(options: { auto?: boolean } = {}): void {
    const { queue, queueIndex, repeatMode, isPlaying } = this.state.get();
    if (queue.length === 0) return;
    let index = queueIndex + 1;
    if (index >= queue.length) {
      if (repeatMode !== "all") {
        this.stopAtEnd();
        return;
      }
      index = 0;
    }
    if (!options.auto) this.unlock();
    void this.load(index, { autoplay: options.auto || isPlaying });
  }

  previous(): void {
    const { queue, queueIndex, repeatMode, isPlaying } = this.state.get();
    if (queue.length === 0) return;
    if (this.loadedTrackId && this.media.currentTime > RESTART_THRESHOLD_SECONDS) {
      this.seek(0);
      return;
    }
    let index = queueIndex - 1;
    if (index < 0) {
      if (repeatMode !== "all") {
        this.seek(0);
        return;
      }
      index = queue.length - 1;
    }
    this.unlock();
    void this.load(index, { autoplay: isPlaying });
  }

  private stopAtEnd(): void {
    if (this.loadedTrackId) {
      this.media.pause();
      this.media.currentTime = 0;
    }
    this.update({ isPlaying: false, isLoading: false });
    this.progress.set({ currentTime: 0, duration: this.progress.get().duration });
    this.session?.setPlaybackState("paused");
  }

  setRepeatMode(repeatMode: RepeatMode): void {
    this.update({ repeatMode });
  }

  cycleRepeatMode(): void {
    const order: RepeatMode[] = ["off", "all", "one"];
    const current = order.indexOf(this.state.get().repeatMode);
    this.setRepeatMode(order[(current + 1) % order.length]);
  }

  setShuffle(shuffle: boolean): void {
    const { shuffle: current, currentTrackId, queue } = this.state.get();
    if (shuffle === current) return;
    if (queue.length === 0) {
      this.update({ shuffle });
      return;
    }
    if (shuffle) {
      const rest = shuffleIds(
        this.originalQueue.filter((id) => id !== currentTrackId),
        this.random,
      );
      this.update({ shuffle, queue: currentTrackId ? [currentTrackId, ...rest] : rest, queueIndex: currentTrackId ? 0 : -1 });
    } else {
      const restored = [...this.originalQueue];
      this.update({
        shuffle,
        queue: restored,
        queueIndex: currentTrackId ? restored.indexOf(currentTrackId) : -1,
      });
    }
  }

  toggleShuffle(): void {
    this.setShuffle(!this.state.get().shuffle);
  }

  setVolume(volume: number): void {
    const value = Math.min(Math.max(volume, 0), 1);
    this.media.volume = value;
    this.update({ volume: value });
  }

  setPlaybackRate(rate: number): void {
    const value = Math.min(Math.max(rate, 0.25), 4);
    // A new source resets playbackRate to defaultPlaybackRate, so set both.
    this.media.defaultPlaybackRate = value;
    this.media.playbackRate = value;
    this.update({ playbackRate: value });
  }

  setAutoplay(enabled: boolean): void {
    this.autoplayNext = enabled;
  }

  setPreferTrackButtons(prefer: boolean): void {
    this.session?.setPreferTrackButtons(prefer);
  }

  /** Appends tracks to the end of the queue. */
  addToQueue(trackIds: readonly string[]): void {
    if (trackIds.length === 0) return;
    const { queue, currentTrackId } = this.state.get();
    this.originalQueue = [...this.originalQueue, ...trackIds];
    if (!currentTrackId && queue.length === 0) {
      this.update({ queue: [...trackIds], queueIndex: 0, currentTrackId: trackIds[0] });
      this.describeNowPlaying(trackIds[0]);
      return;
    }
    this.update({ queue: [...queue, ...trackIds] });
  }

  /** Inserts a track right after the current one. */
  playNext(trackId: string): void {
    const { queue, queueIndex, currentTrackId } = this.state.get();
    if (!currentTrackId) {
      this.addToQueue([trackId]);
      return;
    }
    const nextQueue = [...queue];
    nextQueue.splice(queueIndex + 1, 0, trackId);
    const originalIndex = this.originalQueue.indexOf(currentTrackId);
    this.originalQueue.splice(originalIndex + 1, 0, trackId);
    this.update({ queue: nextQueue });
  }

  /** Removes deleted tracks; stops playback if the current track is one. */
  removeTracks(trackIds: readonly string[]): void {
    const removed = new Set(trackIds);
    const { queue, currentTrackId } = this.state.get();
    this.originalQueue = this.originalQueue.filter((id) => !removed.has(id));
    const nextQueue = queue.filter((id) => !removed.has(id));
    if (currentTrackId && removed.has(currentTrackId)) {
      this.unload();
      this.update({ queue: nextQueue, queueIndex: -1 });
      return;
    }
    this.update({
      queue: nextQueue,
      queueIndex: currentTrackId ? nextQueue.indexOf(currentTrackId) : -1,
    });
  }

  /** Restores the last session without loading audio until the user taps play. */
  restore(session: { queue: readonly string[]; trackId: string | null; position: number }): void {
    const { trackId } = session;
    const queue = [...session.queue];
    if (trackId && !queue.includes(trackId)) queue.unshift(trackId);
    const index = trackId ? queue.indexOf(trackId) : -1;
    this.originalQueue = [...queue];
    this.restorePosition = Math.max(0, session.position);
    this.update({ queue, queueIndex: index, currentTrackId: trackId });
    const description = trackId ? this.describeNowPlaying(trackId) : undefined;
    this.progress.set({ currentTime: this.restorePosition, duration: description?.duration ?? 0 });
  }

  /** Re-reads track metadata (after an edit) for the lock screen. */
  refreshNowPlaying(): void {
    const { currentTrackId } = this.state.get();
    if (currentTrackId) this.describeNowPlaying(currentTrackId);
  }

  /** Stops playback and releases the current audio. */
  unload(): void {
    this.loadToken++;
    this.loadedTrackId = null;
    this.pendingSeek = null;
    this.restorePosition = 0;
    this.media.pause();
    this.media.removeAttribute("src");
    this.media.load();
    this.releaseObjectUrl();
    this.update({ currentTrackId: null, queueIndex: -1, isPlaying: false, isLoading: false, error: null });
    this.progress.set(INITIAL_PROGRESS);
    this.session?.setNowPlaying(null);
    this.session?.setPlaybackState("none");
  }

  /** Clears the queue entirely. */
  reset(): void {
    this.unload();
    this.originalQueue = [];
    this.update({ queue: [] });
  }

  clearError(): void {
    this.update({ error: null });
  }

  dispose(): void {
    this.unload();
    this.removeMediaListeners();
    this.session?.dispose();
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  /**
   * Must be called synchronously from a user gesture before any await.
   * See `SILENT_AUDIO_SRC` for why.
   */
  private unlock(): void {
    if (this.unlocked || !this.deps.unlockSrc) return;
    this.unlocked = true;
    this.loadedTrackId = null;
    this.media.src = this.deps.unlockSrc;
    this.media.play().catch(() => {
      // Superseded by the real track; only the gesture matters.
    });
  }

  private describeNowPlaying(trackId: string): TrackDescription | undefined {
    const description = this.deps.describeTrack(trackId);
    this.session?.setNowPlaying(description ?? null);
    return description;
  }

  private async load(index: number, options: { autoplay: boolean; startAt?: number }): Promise<void> {
    const trackId = this.state.get().queue[index];
    if (trackId === undefined) return;
    const token = ++this.loadToken;
    const description = this.describeNowPlaying(trackId);
    this.update({
      currentTrackId: trackId,
      queueIndex: index,
      isLoading: options.autoplay,
      isPlaying: false,
      error: null,
    });
    this.progress.set({ currentTime: options.startAt ?? 0, duration: description?.duration ?? 0 });

    let blob: Blob | undefined;
    try {
      blob = await this.deps.loadAudio(trackId);
    } catch {
      blob = undefined;
    }
    if (token !== this.loadToken) return; // A newer load superseded this one.
    if (!blob) {
      this.fail(MISSING_AUDIO_ERROR);
      return;
    }

    const previousUrl = this.objectUrl;
    this.objectUrl = (this.deps.createObjectUrl ?? URL.createObjectURL)(blob);
    this.loadedTrackId = trackId;
    this.pendingSeek = options.startAt && options.startAt > 0 ? options.startAt : null;
    this.media.src = this.objectUrl;
    // Revoke only after the element has switched to the new source.
    if (previousUrl) (this.deps.revokeObjectUrl ?? URL.revokeObjectURL)(previousUrl);

    if (options.autoplay) await this.safePlay();
    else this.update({ isLoading: false });
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) (this.deps.revokeObjectUrl ?? URL.revokeObjectURL)(this.objectUrl);
    this.objectUrl = null;
  }

  private async safePlay(): Promise<void> {
    try {
      await this.media.play();
    } catch (error) {
      const name = errorName(error);
      if (name === "AbortError") return; // Interrupted by a newer load or pause.
      this.update({ isPlaying: false, isLoading: false });
      // NotAllowedError: the browser needs a tap first; the play button works.
      if (name !== "NotAllowedError") this.fail(PLAYBACK_ERROR);
    }
  }

  private fail(message: string): void {
    this.update({ error: message, isPlaying: false, isLoading: false });
    this.session?.setPlaybackState("paused");
  }

  private handleEnded(): void {
    const { repeatMode, currentTrackId } = this.state.get();
    if (!currentTrackId) return;
    if (repeatMode === "one") {
      this.media.currentTime = 0;
      this.countedLoadToken = -1; // Count the replay as a new play.
      void this.safePlay();
      return;
    }
    if (!this.autoplayNext) {
      this.update({ isPlaying: false });
      return;
    }
    this.next({ auto: true });
  }

  private syncPosition(): void {
    this.session?.setPosition({
      duration: this.media.duration,
      position: this.media.currentTime,
      playbackRate: this.media.playbackRate,
    });
  }

  private attachMediaListeners(): () => void {
    const media = this.media;
    // Events from the unlock clip or an unloaded element are ignored.
    const active = () => this.loadedTrackId !== null;
    const handlers: Record<string, () => void> = {
      play: () => {
        if (!active()) return;
        this.update({ isPlaying: true, error: null });
        this.session?.setPlaybackState("playing");
        if (this.countedLoadToken !== this.loadToken && this.loadedTrackId) {
          this.countedLoadToken = this.loadToken;
          this.emit("trackstart", this.loadedTrackId);
        }
      },
      playing: () => {
        if (active()) this.update({ isPlaying: true, isLoading: false });
      },
      pause: () => {
        if (!active()) return;
        this.update({ isPlaying: false });
        this.session?.setPlaybackState("paused");
        this.syncPosition();
      },
      waiting: () => {
        if (active() && !media.paused) this.update({ isLoading: true });
      },
      canplay: () => {
        if (active()) this.update({ isLoading: false });
      },
      timeupdate: () => {
        if (!active()) return;
        this.progress.set({ currentTime: media.currentTime, duration: this.progress.get().duration });
      },
      loadedmetadata: () => this.handleDuration(),
      durationchange: () => this.handleDuration(),
      seeked: () => {
        if (active()) this.syncPosition();
      },
      ratechange: () => {
        if (!active()) return;
        this.update({ playbackRate: media.playbackRate });
        this.syncPosition();
      },
      volumechange: () => {
        this.update({ volume: media.volume });
      },
      ended: () => {
        if (active()) this.handleEnded();
      },
      error: () => {
        if (active()) this.fail(PLAYBACK_ERROR);
      },
    };
    for (const [type, handler] of Object.entries(handlers)) media.addEventListener(type, handler);
    return () => {
      for (const [type, handler] of Object.entries(handlers)) media.removeEventListener(type, handler);
    };
  }

  private handleDuration(): void {
    const trackId = this.loadedTrackId;
    if (!trackId) return;
    const duration = this.media.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (this.pendingSeek !== null) {
      this.media.currentTime = Math.min(this.pendingSeek, duration);
      this.pendingSeek = null;
    }
    this.progress.set({ currentTime: this.media.currentTime, duration });
    this.syncPosition();
    if (this.durationReportedToken !== this.loadToken) {
      this.durationReportedToken = this.loadToken;
      this.emit("duration", trackId, duration);
    }
  }
}

/** iOS ignores writes to `volume`; detect that so the UI can hide the slider. */
function detectVolumeControl(media: MediaElement): boolean {
  const original = media.volume;
  try {
    media.volume = original === 0.5 ? 0.4 : 0.5;
    const supported = media.volume !== original;
    media.volume = original;
    return supported;
  } catch {
    return false;
  }
}
