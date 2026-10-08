"use client";

import { useDeferredValue, useMemo, useSyncExternalStore } from "react";
import type { Track, TrackSort } from "@/types/track";
import { libraryStore, type Collection } from "@/lib/library/library-store";
import { searchTracks, sortTracks } from "@/lib/library/query";

export function useLibrary(): Collection<Track> {
  return useSyncExternalStore(libraryStore.subscribe, libraryStore.get, libraryStore.get);
}

/**
 * Searched and sorted tracks. The query is deferred so typing stays
 * responsive with large libraries.
 */
export function useLibraryView(query: string, sort: TrackSort): Track[] {
  const { items } = useLibrary();
  const deferredQuery = useDeferredValue(query);
  return useMemo(() => sortTracks(searchTracks(items, deferredQuery), sort), [items, deferredQuery, sort]);
}
