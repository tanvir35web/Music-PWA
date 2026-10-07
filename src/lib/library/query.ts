import type { Track, TrackSort } from "@/types/track";

/** Lower-cases and strips accents so "beyonce" matches "Beyoncé". */
export function normaliseSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Every word in the query must appear in the title, artist or album. */
export function searchTracks(tracks: readonly Track[], query: string): Track[] {
  const terms = normaliseSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...tracks];
  return tracks.filter((track) => {
    const haystack = normaliseSearchText(
      [track.title, track.artist ?? "", track.album ?? ""].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
/** Sorts tracks without an artist last. */
const NO_ARTIST = "￿";

export function sortTracks(tracks: readonly Track[], sort: TrackSort): Track[] {
  const sorted = [...tracks];
  switch (sort) {
    case "title":
      return sorted.sort((a, b) => collator.compare(a.title, b.title));
    case "artist":
      return sorted.sort(
        (a, b) =>
          collator.compare(a.artist ?? NO_ARTIST, b.artist ?? NO_ARTIST) ||
          collator.compare(a.title, b.title),
      );
    case "recent":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export function recentlyPlayed(tracks: readonly Track[], limit = 20): Track[] {
  return tracks
    .filter((t) => t.lastPlayedAt !== undefined)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .slice(0, limit);
}

export function favourites(tracks: readonly Track[]): Track[] {
  return tracks.filter((t) => t.isFavorite);
}

/** Resolves ids to tracks, skipping any that no longer exist. */
export function resolveTracks(ids: readonly string[], byId: ReadonlyMap<string, Track>): Track[] {
  const result: Track[] = [];
  for (const id of ids) {
    const track = byId.get(id);
    if (track) result.push(track);
  }
  return result;
}
