import type { Track } from "@/types/track";
import { STORES, transact } from "./indexed-db";

export type TrackEdit = Partial<
  Pick<Track, "title" | "artist" | "album" | "duration" | "isFavorite">
>;

export function getAllTracks(): Promise<Track[]> {
  return transact(STORES.tracks, "readonly", (tx) => {
    const request = tx.objectStore(STORES.tracks).getAll();
    return () => request.result as Track[];
  });
}

export function getTrack(id: string): Promise<Track | undefined> {
  return transact(STORES.tracks, "readonly", (tx) => {
    const request = tx.objectStore(STORES.tracks).get(id);
    return () => request.result as Track | undefined;
  });
}

export function countTracks(): Promise<number> {
  return transact(STORES.tracks, "readonly", (tx) => {
    const request = tx.objectStore(STORES.tracks).count();
    return () => request.result;
  });
}

/** Saves metadata and audio atomically: either both are stored or neither. */
export function createTrack(track: Track, audio: Blob): Promise<Track> {
  return transact([STORES.tracks, STORES.audioFiles], "readwrite", (tx) => {
    tx.objectStore(STORES.tracks).add(track);
    tx.objectStore(STORES.audioFiles).put({ trackId: track.id, blob: audio });
    return () => track;
  });
}

/** Loads the audio Blob only when it is needed for playback. */
export function getAudioBlob(trackId: string): Promise<Blob | undefined> {
  return transact(STORES.audioFiles, "readonly", (tx) => {
    const request = tx.objectStore(STORES.audioFiles).get(trackId);
    return () => (request.result as { blob: Blob } | undefined)?.blob;
  });
}

function modifyTrack(
  id: string,
  mutate: (track: Track) => Track,
): Promise<Track | undefined> {
  return transact(STORES.tracks, "readwrite", (tx) => {
    const store = tx.objectStore(STORES.tracks);
    const request = store.get(id);
    let updated: Track | undefined;
    request.onsuccess = () => {
      const current = request.result as Track | undefined;
      if (!current) return;
      updated = mutate(current);
      store.put(updated);
    };
    return () => updated;
  });
}

export function updateTrack(
  id: string,
  edit: TrackEdit,
  now = Date.now(),
): Promise<Track | undefined> {
  return modifyTrack(id, (track) => ({ ...track, ...edit, updatedAt: now }));
}

export function markTrackPlayed(
  id: string,
  now = Date.now(),
): Promise<Track | undefined> {
  return modifyTrack(id, (track) => ({
    ...track,
    playCount: (track.playCount ?? 0) + 1,
    lastPlayedAt: now,
  }));
}

export function deleteTrack(id: string): Promise<void> {
  return deleteTracks([id]);
}

/** Deletes several tracks and their audio in one transaction. */
export function deleteTracks(ids: readonly string[]): Promise<void> {
  return transact([STORES.tracks, STORES.audioFiles], "readwrite", (tx) => {
    for (const id of ids) {
      tx.objectStore(STORES.tracks).delete(id);
      tx.objectStore(STORES.audioFiles).delete(id);
    }
    return () => undefined;
  });
}

export function deleteAllTracks(): Promise<void> {
  return transact([STORES.tracks, STORES.audioFiles], "readwrite", (tx) => {
    tx.objectStore(STORES.tracks).clear();
    tx.objectStore(STORES.audioFiles).clear();
    return () => undefined;
  });
}

/** Finds an existing track with the same fingerprint or content hash. */
export function findDuplicateTrack(keys: {
  fingerprint?: string;
  contentHash?: string;
}): Promise<Track | undefined> {
  return transact(STORES.tracks, "readonly", (tx) => {
    const store = tx.objectStore(STORES.tracks);
    let match: Track | undefined;
    const lookups: Array<[string, string | undefined]> = [
      ["fingerprint", keys.fingerprint],
      ["contentHash", keys.contentHash],
    ];
    for (const [index, value] of lookups) {
      if (!value) continue;
      const request = store.index(index).get(value);
      request.onsuccess = () => {
        match ??= request.result as Track | undefined;
      };
    }
    return () => match;
  });
}
