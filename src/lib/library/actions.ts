import type { Track } from "@/types/track";
import type { Playlist } from "@/types/playlist";
import * as tracksRepo from "@/lib/db/tracks-repository";
import * as playlistsRepo from "@/lib/db/playlists-repository";
import { clearAllStores } from "@/lib/db/indexed-db";
import { getPlayer } from "@/lib/audio/player";
import { requestPersistentStorage } from "@/lib/pwa/storage";
import { resetSettingsStore, saveSettings, settingsStore } from "@/lib/settings/settings-store";
import {
  libraryStore,
  playlistStore,
  removePlaylistsFromStore,
  removeTracksFromStore,
  upsertPlaylists,
  upsertTracks,
} from "./library-store";

/**
 * Use cases that span IndexedDB, the in-memory stores and the player.
 * UI components call these instead of repositories, so every change is
 * applied consistently.
 */

let persistenceRequested = false;

export function addImportedTrack(track: Track): void {
  upsertTracks([track]);
  if (!persistenceRequested) {
    persistenceRequested = true;
    void requestPersistentStorage();
  }
}

export async function deleteTracks(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await tracksRepo.deleteTracks(ids);
  upsertPlaylists(await playlistsRepo.removeTracksFromAllPlaylists(ids));
  getPlayer().removeTracks(ids);
  removeTracksFromStore(ids);
  const { lastTrackId, lastQueue } = settingsStore.get();
  saveSettings({
    lastTrackId: lastTrackId && ids.includes(lastTrackId) ? null : lastTrackId,
    lastQueue: lastQueue.filter((id) => !ids.includes(id)),
  });
}

export async function deleteAllTracks(): Promise<void> {
  const ids = libraryStore.get().items.map((t) => t.id);
  await tracksRepo.deleteAllTracks();
  upsertPlaylists(await playlistsRepo.removeTracksFromAllPlaylists(ids));
  getPlayer().reset();
  removeTracksFromStore(ids);
  saveSettings({ lastTrackId: null, lastPosition: 0, lastQueue: [] });
}

export async function editTrack(id: string, edit: tracksRepo.TrackEdit): Promise<void> {
  const updated = await tracksRepo.updateTrack(id, edit);
  if (!updated) return;
  upsertTracks([updated]);
  if (getPlayer().getState().currentTrackId === id) getPlayer().refreshNowPlaying();
}

export async function toggleFavorite(id: string): Promise<void> {
  const track = libraryStore.get().byId.get(id);
  if (track) await editTrack(id, { isFavorite: !track.isFavorite });
}

export async function recordPlay(id: string): Promise<void> {
  const updated = await tracksRepo.markTrackPlayed(id);
  if (updated) upsertTracks([updated]);
}

/** Stores a duration measured by the browser when tags didn't provide one. */
export async function recordDuration(id: string, seconds: number): Promise<void> {
  const track = libraryStore.get().byId.get(id);
  if (!track || (track.duration !== undefined && Math.abs(track.duration - seconds) < 1)) return;
  await editTrack(id, { duration: seconds });
}

export async function createPlaylist(name: string, trackIds: string[] = []): Promise<Playlist> {
  const playlist = await playlistsRepo.createPlaylist(name, trackIds);
  upsertPlaylists([playlist]);
  return playlist;
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const updated = await playlistsRepo.renamePlaylist(id, name);
  if (updated) upsertPlaylists([updated]);
}

export async function deletePlaylist(id: string): Promise<void> {
  await playlistsRepo.deletePlaylist(id);
  removePlaylistsFromStore([id]);
}

export async function addTracksToPlaylist(id: string, trackIds: string[]): Promise<void> {
  const updated = await playlistsRepo.addTracksToPlaylist(id, trackIds);
  if (updated) upsertPlaylists([updated]);
}

export async function removeTrackFromPlaylist(id: string, trackId: string): Promise<void> {
  const updated = await playlistsRepo.removeTrackFromPlaylist(id, trackId);
  if (updated) upsertPlaylists([updated]);
}

export async function clearPlaylists(): Promise<void> {
  const ids = playlistStore.get().items.map((p) => p.id);
  await playlistsRepo.clearPlaylists();
  removePlaylistsFromStore(ids);
}

/** Deletes every track, playlist and setting stored on this device. */
export async function clearAllData(): Promise<void> {
  getPlayer().reset();
  await clearAllStores();
  removeTracksFromStore(libraryStore.get().items.map((t) => t.id));
  removePlaylistsFromStore(playlistStore.get().items.map((p) => p.id));
  resetSettingsStore();
}
