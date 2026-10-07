import { describe, expect, it } from "vitest";
import type { Track } from "@/types/track";
import {
  countTracks,
  createTrack,
  deleteAllTracks,
  deleteTrack,
  findDuplicateTrack,
  getAllTracks,
  getAudioBlob,
  getTrack,
  markTrackPlayed,
  updateTrack,
} from "./tracks-repository";
import {
  addTracksToPlaylist,
  clearPlaylists,
  createPlaylist,
  deletePlaylist,
  getAllPlaylists,
  getPlaylist,
  removeTrackFromPlaylist,
  removeTracksFromAllPlaylists,
  renamePlaylist,
} from "./playlists-repository";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "./settings-repository";
import { clearAllStores } from "./indexed-db";

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "t1",
    title: "Song",
    artist: "Artist",
    mimeType: "audio/mpeg",
    size: 3,
    isFavorite: false,
    playCount: 0,
    createdAt: 1,
    updatedAt: 1,
    source: { kind: "file", fileName: "song.mp3", lastModified: 1 },
    fingerprint: "file:song.mp3:3:1",
    contentHash: "sha256:abc",
    ...overrides,
  };
}

const audio = () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" });

describe("tracks repository", () => {
  it("creates and reads a track with its audio", async () => {
    await createTrack(makeTrack(), audio());

    expect(await getTrack("t1")).toMatchObject({ title: "Song", artist: "Artist" });
    expect(await getAllTracks()).toHaveLength(1);
    expect(await countTracks()).toBe(1);
    const blob = await getAudioBlob("t1");
    expect(blob?.size).toBe(3);
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("returns undefined for unknown ids", async () => {
    expect(await getTrack("missing")).toBeUndefined();
    expect(await getAudioBlob("missing")).toBeUndefined();
    expect(await updateTrack("missing", { title: "x" })).toBeUndefined();
  });

  it("rejects a second track with the same id without storing audio", async () => {
    await createTrack(makeTrack(), audio());
    await expect(createTrack(makeTrack({ title: "Other" }), audio())).rejects.toBeDefined();
    expect((await getTrack("t1"))?.title).toBe("Song");
  });

  it("updates metadata and favourites", async () => {
    await createTrack(makeTrack(), audio());
    const updated = await updateTrack("t1", { title: "Renamed", isFavorite: true }, 99);
    expect(updated).toMatchObject({ title: "Renamed", isFavorite: true, updatedAt: 99 });
    expect((await getTrack("t1"))?.isFavorite).toBe(true);
  });

  it("records plays", async () => {
    await createTrack(makeTrack(), audio());
    await markTrackPlayed("t1", 10);
    const track = await markTrackPlayed("t1", 20);
    expect(track).toMatchObject({ playCount: 2, lastPlayedAt: 20 });
  });

  it("deletes a track and its audio", async () => {
    await createTrack(makeTrack(), audio());
    await deleteTrack("t1");
    expect(await getTrack("t1")).toBeUndefined();
    expect(await getAudioBlob("t1")).toBeUndefined();
  });

  it("deletes all tracks", async () => {
    await createTrack(makeTrack(), audio());
    await createTrack(makeTrack({ id: "t2", fingerprint: "f2", contentHash: "h2" }), audio());
    await deleteAllTracks();
    expect(await countTracks()).toBe(0);
  });

  it("finds duplicates by fingerprint or content hash", async () => {
    await createTrack(makeTrack(), audio());
    expect((await findDuplicateTrack({ fingerprint: "file:song.mp3:3:1" }))?.id).toBe("t1");
    expect((await findDuplicateTrack({ contentHash: "sha256:abc" }))?.id).toBe("t1");
    expect(await findDuplicateTrack({ fingerprint: "other", contentHash: "other" })).toBeUndefined();
    expect(await findDuplicateTrack({})).toBeUndefined();
  });
});

describe("playlists repository", () => {
  it("creates, renames and deletes playlists", async () => {
    const playlist = await createPlaylist("  Focus  ");
    expect(playlist.name).toBe("Focus");
    expect((await renamePlaylist(playlist.id, "Deep Focus"))?.name).toBe("Deep Focus");
    await deletePlaylist(playlist.id);
    expect(await getPlaylist(playlist.id)).toBeUndefined();
  });

  it("rejects empty names", async () => {
    await expect(createPlaylist("   ")).rejects.toThrow();
    const playlist = await createPlaylist("Sleep");
    await expect(renamePlaylist(playlist.id, "")).rejects.toThrow();
  });

  it("adds tracks without duplicates and removes them", async () => {
    const playlist = await createPlaylist("Workout", ["a"]);
    await addTracksToPlaylist(playlist.id, ["a", "b", "c", "b"]);
    expect((await getPlaylist(playlist.id))?.trackIds).toEqual(["a", "b", "c"]);
    await removeTrackFromPlaylist(playlist.id, "b");
    expect((await getPlaylist(playlist.id))?.trackIds).toEqual(["a", "c"]);
  });

  it("removes deleted tracks from every playlist", async () => {
    const one = await createPlaylist("One", ["a", "b"]);
    const two = await createPlaylist("Two", ["b"]);
    const three = await createPlaylist("Three", ["c"]);
    const changed = await removeTracksFromAllPlaylists(["b"]);
    expect(changed.map((p) => p.id).sort()).toEqual([one.id, two.id].sort());
    expect((await getPlaylist(one.id))?.trackIds).toEqual(["a"]);
    expect((await getPlaylist(three.id))?.trackIds).toEqual(["c"]);
  });

  it("clears playlists", async () => {
    await createPlaylist("One");
    await clearPlaylists();
    expect(await getAllPlaylists()).toEqual([]);
  });
});

describe("settings repository", () => {
  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("persists valid values and ignores invalid ones", async () => {
    await updateSettings({ volume: 0.5, repeatMode: "all" });
    await updateSettings({ volume: 7 } as never);
    const settings = await getSettings();
    expect(settings.volume).toBe(0.5);
    expect(settings.repeatMode).toBe("all");
  });
});

describe("clearAllStores", () => {
  it("removes every record", async () => {
    await createTrack(makeTrack(), audio());
    await createPlaylist("One");
    await updateSettings({ shuffle: true });
    await clearAllStores();
    expect(await countTracks()).toBe(0);
    expect(await getAllPlaylists()).toEqual([]);
    expect((await getSettings()).shuffle).toBe(false);
  });
});
