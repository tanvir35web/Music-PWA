import type { Track } from "@/types/track";
import type { Playlist } from "@/types/playlist";
import { createStore, type Store } from "@/lib/utils/store";
import { getAllTracks } from "@/lib/db/tracks-repository";
import { getAllPlaylists } from "@/lib/db/playlists-repository";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface Collection<T extends { id: string }> {
  status: LoadStatus;
  items: T[];
  byId: ReadonlyMap<string, T>;
  error: string | null;
}

function collection<T extends { id: string }>(
  items: T[],
  status: LoadStatus,
  error: string | null = null,
): Collection<T> {
  return { status, items, byId: new Map(items.map((item) => [item.id, item])), error };
}

/** In-memory copy of track metadata. Audio Blobs are never held here. */
export const libraryStore = createStore<Collection<Track>>(collection([], "idle"));
export const playlistStore = createStore<Collection<Playlist>>(collection([], "idle"));

async function loadInto<T extends { id: string }>(
  store: Store<Collection<T>>,
  read: () => Promise<T[]>,
  failure: string,
): Promise<void> {
  store.set((current) => collection(current.items, "loading"));
  try {
    store.set(collection(await read(), "ready"));
  } catch (error) {
    console.error(failure, error);
    store.set((current) => collection(current.items, "error", failure));
  }
}

export function loadLibrary(): Promise<void> {
  return loadInto(libraryStore, getAllTracks, "Your library couldn't be loaded from this device.");
}

export function loadPlaylists(): Promise<void> {
  return loadInto(playlistStore, getAllPlaylists, "Your playlists couldn't be loaded.");
}

function upsert<T extends { id: string }>(current: Collection<T>, updated: T[]): Collection<T> {
  if (updated.length === 0) return current;
  const changes = new Map(updated.map((item) => [item.id, item]));
  const items = current.items.map((item) => changes.get(item.id) ?? item);
  for (const item of updated) if (!current.byId.has(item.id)) items.push(item);
  return collection(items, current.status === "idle" ? "ready" : current.status);
}

function remove<T extends { id: string }>(current: Collection<T>, ids: readonly string[]): Collection<T> {
  const removed = new Set(ids);
  return collection(current.items.filter((item) => !removed.has(item.id)), current.status);
}

export const upsertTracks = (tracks: Track[]) => libraryStore.set((c) => upsert(c, tracks));
export const removeTracksFromStore = (ids: readonly string[]) => libraryStore.set((c) => remove(c, ids));
export const upsertPlaylists = (playlists: Playlist[]) => playlistStore.set((c) => upsert(c, playlists));
export const removePlaylistsFromStore = (ids: readonly string[]) =>
  playlistStore.set((c) => remove(c, ids));
