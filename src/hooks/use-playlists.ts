"use client";

import { useSyncExternalStore } from "react";
import type { Playlist } from "@/types/playlist";
import { playlistStore, type Collection } from "@/lib/library/library-store";

export function usePlaylists(): Collection<Playlist> {
  return useSyncExternalStore(playlistStore.subscribe, playlistStore.get, playlistStore.get);
}
