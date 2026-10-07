import type { PlayerState } from "@/types/player";
import type { AppSettings } from "@/types/settings";
import { getPlayer } from "@/lib/audio/player";
import { recordDuration, recordPlay } from "@/lib/library/actions";
import { libraryStore, loadLibrary, loadPlaylists } from "@/lib/library/library-store";
import { registerServiceWorker } from "@/lib/pwa/service-worker";
import { loadSettings, saveSettings, settingsStore } from "@/lib/settings/settings-store";
import { toast } from "@/lib/utils/toast";

export const THEME_STORAGE_KEY = "theme";
const POSITION_SAVE_INTERVAL_MS = 15_000;

let started = false;

/**
 * Starts app-wide services once per page load: data loading, session
 * restore, playback persistence and the service worker. These live for the
 * whole app lifetime, so there is no teardown.
 */
export function startApp(): void {
  if (started) return;
  started = true;
  void registerServiceWorker();
  void initialise();
}

async function initialise(): Promise<void> {
  const [settings] = await Promise.all([loadSettings(), loadLibrary(), loadPlaylists()]);
  const engine = getPlayer();

  applyTheme(settings.theme);
  engine.setRepeatMode(settings.repeatMode);
  engine.setShuffle(settings.shuffle);
  engine.setVolume(settings.volume);
  engine.setPlaybackRate(settings.playbackRate);
  engine.setAutoplay(settings.autoplay);
  engine.setPreferTrackButtons(settings.preferTrackButtons);

  const { byId, status } = libraryStore.get();
  if (status === "error") toast(libraryStore.get().error ?? "Your library couldn't be loaded.", "error");
  if (settings.lastTrackId && byId.has(settings.lastTrackId)) {
    engine.restore({
      queue: settings.lastQueue.filter((id) => byId.has(id)),
      trackId: settings.lastTrackId,
      position: settings.lastPosition,
    });
  }

  engine.on("trackstart", (id) => void recordPlay(id).catch(console.error));
  engine.on("duration", (id, seconds) => void recordDuration(id, seconds).catch(console.error));

  persistPlayerState();
  persistPosition();
  applySettingsChanges();
}

/** Saves queue, current track and modes whenever they change. */
function persistPlayerState(): void {
  const engine = getPlayer();
  let previous: PlayerState = engine.getState();
  engine.subscribe(() => {
    const state = engine.getState();
    const patch: Partial<AppSettings> = {};
    if (state.repeatMode !== previous.repeatMode) patch.repeatMode = state.repeatMode;
    if (state.shuffle !== previous.shuffle) patch.shuffle = state.shuffle;
    if (state.volume !== previous.volume) patch.volume = state.volume;
    if (state.playbackRate !== previous.playbackRate) patch.playbackRate = state.playbackRate;
    if (state.currentTrackId !== previous.currentTrackId) {
      patch.lastTrackId = state.currentTrackId;
      patch.lastPosition = 0;
    }
    if (state.queue !== previous.queue) patch.lastQueue = state.queue;
    if (state.error && state.error !== previous.error) toast(state.error, "error");
    previous = state;
    if (Object.keys(patch).length > 0) saveSettings(patch);
  });
}

/** Saves the playback position periodically and when the app is backgrounded. */
function persistPosition(): void {
  const engine = getPlayer();
  const save = () => {
    const { currentTrackId } = engine.getState();
    if (!currentTrackId) return;
    saveSettings({ lastPosition: engine.getProgress().currentTime });
  };
  setInterval(() => {
    if (engine.getState().isPlaying) save();
  }, POSITION_SAVE_INTERVAL_MS);
  let wasPlaying = false;
  engine.subscribe(() => {
    const { isPlaying } = engine.getState();
    if (wasPlaying && !isPlaying) save();
    wasPlaying = isPlaying;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
  window.addEventListener("pagehide", save);
}

/** Pushes settings edited on the Settings screen into the engine and DOM. */
function applySettingsChanges(): void {
  const engine = getPlayer();
  let previous = settingsStore.get();
  settingsStore.subscribe(() => {
    const next = settingsStore.get();
    if (next.theme !== previous.theme) applyTheme(next.theme);
    if (next.autoplay !== previous.autoplay) engine.setAutoplay(next.autoplay);
    if (next.preferTrackButtons !== previous.preferTrackButtons) {
      engine.setPreferTrackButtons(next.preferTrackButtons);
    }
    previous = next;
  });
}

export function applyTheme(theme: AppSettings["theme"]): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Mirrored for /theme-init.js, which applies it before first paint.
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable; the theme still applies for this session.
  }
}
