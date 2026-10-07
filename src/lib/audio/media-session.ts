/**
 * Media Session integration: lock screen, Control Center, headphones and car
 * controls. Every call is a no-op when the API is unavailable.
 */

export interface MediaSessionHandlers {
  play(): void;
  pause(): void;
  previous(): void;
  next(): void;
  seekBy(seconds: number): void;
  seekTo(seconds: number): void;
}

export interface NowPlayingInfo {
  title: string;
  artist?: string;
  album?: string;
  coverArt?: Blob;
}

export interface MediaSessionController {
  setNowPlaying(info: NowPlayingInfo | null): void;
  setPlaybackState(state: "playing" | "paused" | "none"): void;
  setPosition(position: { duration: number; position: number; playbackRate: number }): void;
  /**
   * iOS shows either previous/next-track or skip-10-seconds buttons. When
   * `preferTrackButtons` is true the seek handlers are left unregistered.
   */
  setPreferTrackButtons(prefer: boolean): void;
  dispose(): void;
}

const SEEK_STEP_SECONDS = 10;

const FALLBACK_ARTWORK: MediaImage[] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
];

const noop: MediaSessionController = {
  setNowPlaying() {},
  setPlaybackState() {},
  setPosition() {},
  setPreferTrackButtons() {},
  dispose() {},
};

function trySetHandler(
  session: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
): void {
  try {
    session.setActionHandler(action, handler);
  } catch {
    // The browser does not support this action.
  }
}

export function createMediaSession(
  handlers: MediaSessionHandlers,
  options: { preferTrackButtons: boolean },
): MediaSessionController {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return noop;
  const session = navigator.mediaSession;
  let artworkUrl: string | null = null;

  const releaseArtwork = () => {
    if (artworkUrl) URL.revokeObjectURL(artworkUrl);
    artworkUrl = null;
  };

  const registerSeek = (enabled: boolean) => {
    trySetHandler(
      session,
      "seekbackward",
      enabled ? (details) => handlers.seekBy(-(details.seekOffset ?? SEEK_STEP_SECONDS)) : null,
    );
    trySetHandler(
      session,
      "seekforward",
      enabled ? (details) => handlers.seekBy(details.seekOffset ?? SEEK_STEP_SECONDS) : null,
    );
  };

  trySetHandler(session, "play", () => handlers.play());
  trySetHandler(session, "pause", () => handlers.pause());
  trySetHandler(session, "previoustrack", () => handlers.previous());
  trySetHandler(session, "nexttrack", () => handlers.next());
  trySetHandler(session, "seekto", (details) => {
    if (details.seekTime !== undefined) handlers.seekTo(details.seekTime);
  });
  registerSeek(!options.preferTrackButtons);

  return {
    setNowPlaying(info) {
      releaseArtwork();
      if (!info || typeof MediaMetadata === "undefined") {
        session.metadata = null;
        return;
      }
      let artwork = FALLBACK_ARTWORK;
      if (info.coverArt) {
        artworkUrl = URL.createObjectURL(info.coverArt);
        artwork = [{ src: artworkUrl, sizes: "512x512", type: info.coverArt.type }];
      }
      session.metadata = new MediaMetadata({
        title: info.title,
        artist: info.artist ?? "",
        album: info.album ?? "",
        artwork,
      });
    },
    setPlaybackState(state) {
      session.playbackState = state;
    },
    setPosition({ duration, position, playbackRate }) {
      if (!session.setPositionState) return;
      if (!Number.isFinite(duration) || duration <= 0) return;
      try {
        session.setPositionState({
          duration,
          playbackRate: playbackRate > 0 ? playbackRate : 1,
          position: Math.min(Math.max(position, 0), duration),
        });
      } catch {
        // Invalid state (e.g. during a track change); the next update fixes it.
      }
    },
    setPreferTrackButtons(prefer) {
      registerSeek(!prefer);
    },
    dispose() {
      releaseArtwork();
      for (const action of [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
        "seekto",
        "seekbackward",
        "seekforward",
      ] as MediaSessionAction[]) {
        trySetHandler(session, action, null);
      }
      session.metadata = null;
    },
  };
}
