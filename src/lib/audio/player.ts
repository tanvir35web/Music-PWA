import { getAudioBlob } from "@/lib/db/tracks-repository";
import { libraryStore } from "@/lib/library/library-store";
import { AudioEngine } from "./audio-engine";
import { createMediaSession } from "./media-session";
import { SILENT_AUDIO_SRC } from "./silence";

let engine: AudioEngine | null = null;

/**
 * The single app-wide audio engine, created on first use in the browser.
 * Never call during server rendering.
 */
export function getPlayer(): AudioEngine {
  if (engine) return engine;
  const media = new Audio();
  media.preload = "auto";
  engine = new AudioEngine({
    media,
    // Audio is read from IndexedDB only when a track is actually played.
    loadAudio: getAudioBlob,
    describeTrack: (id) => {
      const track = libraryStore.get().byId.get(id);
      return (
        track && {
          title: track.title,
          artist: track.artist,
          album: track.album,
          coverArt: track.coverArt,
          duration: track.duration,
        }
      );
    },
    createMediaSession: (handlers) => createMediaSession(handlers, { preferTrackButtons: true }),
    unlockSrc: SILENT_AUDIO_SRC,
  });
  return engine;
}
