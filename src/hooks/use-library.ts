"use client";

import { useDeferredValue, useMemo, useSyncExternalStore } from "react";
import type { Track, TrackSort } from "@/types/track";
import { libraryStore, type Collection } from "@/lib/library/library-store";
import { favourites, recentlyPlayed, searchTracks, sortTracks } from "@/lib/library/query";

export type LibraryFilter = "all" | "favorites" | "recent";

export function useLibrary(): Collection<Track> {
  return useSyncExternalStore(libraryStore.subscribe, libraryStore.get, libraryStore.get);
}

/**
 * Filtered and sorted tracks. The query is deferred so typing stays
 * responsive with large libraries.
 */
export function useLibraryView(query: string, sort: TrackSort, filter: LibraryFilter): Track[] {
  const { items } = useLibrary();
  const deferredQuery = useDeferredValue(query);
  return useMemo(() => {
    const scoped =
      filter === "favorites"
        ? favourites(items)
        : filter === "recent"
          ? recentlyPlayed(items, 50)
          : items;
    const matched = searchTracks(scoped, deferredQuery);
    // "Recent" keeps play order; the other views use the chosen sort.
    return filter === "recent" ? matched : sortTracks(matched, sort);
  }, [items, deferredQuery, sort, filter]);
}
