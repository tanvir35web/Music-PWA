import type { Playlist } from "@/types/playlist";
import { createId } from "@/lib/utils/id";
import { parsePlaylistName } from "@/lib/validation";
import { STORES, transact } from "./indexed-db";

export function getAllPlaylists(): Promise<Playlist[]> {
  return transact(STORES.playlists, "readonly", (tx) => {
    const request = tx.objectStore(STORES.playlists).getAll();
    return () => request.result as Playlist[];
  });
}

export function getPlaylist(id: string): Promise<Playlist | undefined> {
  return transact(STORES.playlists, "readonly", (tx) => {
    const request = tx.objectStore(STORES.playlists).get(id);
    return () => request.result as Playlist | undefined;
  });
}

export async function createPlaylist(
  name: string,
  trackIds: string[] = [],
  now = Date.now(),
): Promise<Playlist> {
  const playlist: Playlist = {
    id: createId(),
    name: parsePlaylistName(name),
    trackIds: unique(trackIds),
    createdAt: now,
    updatedAt: now,
  };
  return transact(STORES.playlists, "readwrite", (tx) => {
    tx.objectStore(STORES.playlists).add(playlist);
    return () => playlist;
  });
}

function modifyPlaylist(
  id: string,
  mutate: (playlist: Playlist) => Playlist,
): Promise<Playlist | undefined> {
  return transact(STORES.playlists, "readwrite", (tx) => {
    const store = tx.objectStore(STORES.playlists);
    const request = store.get(id);
    let updated: Playlist | undefined;
    request.onsuccess = () => {
      const current = request.result as Playlist | undefined;
      if (!current) return;
      updated = { ...mutate(current), updatedAt: Date.now() };
      store.put(updated);
    };
    return () => updated;
  });
}

export async function renamePlaylist(id: string, name: string): Promise<Playlist | undefined> {
  const validName = parsePlaylistName(name);
  return modifyPlaylist(id, (playlist) => ({ ...playlist, name: validName }));
}

export function addTracksToPlaylist(
  id: string,
  trackIds: string[],
): Promise<Playlist | undefined> {
  return modifyPlaylist(id, (playlist) => ({
    ...playlist,
    trackIds: unique([...playlist.trackIds, ...trackIds]),
  }));
}

export function removeTrackFromPlaylist(
  id: string,
  trackId: string,
): Promise<Playlist | undefined> {
  return modifyPlaylist(id, (playlist) => ({
    ...playlist,
    trackIds: playlist.trackIds.filter((t) => t !== trackId),
  }));
}

export function deletePlaylist(id: string): Promise<void> {
  return transact(STORES.playlists, "readwrite", (tx) => {
    tx.objectStore(STORES.playlists).delete(id);
    return () => undefined;
  });
}

export function clearPlaylists(): Promise<void> {
  return transact(STORES.playlists, "readwrite", (tx) => {
    tx.objectStore(STORES.playlists).clear();
    return () => undefined;
  });
}

/** Removes deleted tracks from every playlist. Returns the playlists changed. */
export function removeTracksFromAllPlaylists(trackIds: string[]): Promise<Playlist[]> {
  const removed = new Set(trackIds);
  return transact(STORES.playlists, "readwrite", (tx) => {
    const store = tx.objectStore(STORES.playlists);
    const request = store.getAll();
    const changed: Playlist[] = [];
    request.onsuccess = () => {
      for (const playlist of request.result as Playlist[]) {
        const kept = playlist.trackIds.filter((id) => !removed.has(id));
        if (kept.length === playlist.trackIds.length) continue;
        const updated = { ...playlist, trackIds: kept, updatedAt: Date.now() };
        store.put(updated);
        changed.push(updated);
      }
    };
    return () => changed;
  });
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids));
}
