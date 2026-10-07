import { describe, expect, it } from "vitest";
import type { Track } from "@/types/track";
import { recentlyPlayed, resolveTracks, searchTracks, sortTracks } from "./query";

const track = (id: string, fields: Partial<Track>): Track => ({
  id,
  title: id,
  mimeType: "audio/mpeg",
  size: 1,
  isFavorite: false,
  playCount: 0,
  createdAt: 0,
  updatedAt: 0,
  source: { kind: "file", fileName: id, lastModified: 0 },
  fingerprint: id,
  ...fields,
});

const tracks = [
  track("1", { title: "Halo", artist: "Beyoncé", album: "I Am", createdAt: 3, lastPlayedAt: 5 }),
  track("2", { title: "Track 10", artist: "Air", album: "Moon Safari", createdAt: 1 }),
  track("3", { title: "Track 9", artist: "Air", createdAt: 2, lastPlayedAt: 9 }),
];

describe("searchTracks", () => {
  it("matches title, artist and album, ignoring case and accents", () => {
    expect(searchTracks(tracks, "beyonce").map((t) => t.id)).toEqual(["1"]);
    expect(searchTracks(tracks, "moon").map((t) => t.id)).toEqual(["2"]);
    expect(searchTracks(tracks, "air track").map((t) => t.id)).toEqual(["2", "3"]);
    expect(searchTracks(tracks, "  ")).toHaveLength(3);
    expect(searchTracks(tracks, "zzz")).toHaveLength(0);
  });
});

describe("sortTracks", () => {
  it("sorts by title naturally, by artist, and by date added", () => {
    expect(sortTracks(tracks, "title").map((t) => t.id)).toEqual(["1", "3", "2"]);
    expect(sortTracks(tracks, "artist").map((t) => t.id)).toEqual(["3", "2", "1"]);
    expect(sortTracks(tracks, "recent").map((t) => t.id)).toEqual(["1", "3", "2"]);
  });
});

describe("recentlyPlayed", () => {
  it("lists played tracks, most recent first", () => {
    expect(recentlyPlayed(tracks).map((t) => t.id)).toEqual(["3", "1"]);
  });
});

describe("resolveTracks", () => {
  it("skips ids that no longer exist", () => {
    const byId = new Map(tracks.map((t) => [t.id, t]));
    expect(resolveTracks(["3", "gone", "1"], byId).map((t) => t.id)).toEqual(["3", "1"]);
  });
});
