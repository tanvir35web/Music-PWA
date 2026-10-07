"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Heart, ListMusic, Plus } from "lucide-react";
import { FAVORITES_PLAYLIST_ID, type Playlist } from "@/types/playlist";
import { Button } from "@/components/ui/button";
import { CoverArt } from "@/components/ui/cover-art";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useLibrary } from "@/hooks/use-library";
import { usePlaylists } from "@/hooks/use-playlists";
import { createPlaylist } from "@/lib/library/actions";
import { PlaylistNameSheet } from "./playlist-name-sheet";

function playlistHref(id: string): string {
  return `/playlists/view?id=${encodeURIComponent(id)}`;
}

function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const { byId } = useLibrary();
  const coverTrack = playlist.trackIds.map((id) => byId.get(id)).find((t) => t?.coverArt);
  const count = playlist.trackIds.filter((id) => byId.has(id)).length;
  return (
    <li>
      <Link href={playlistHref(playlist.id)} className="flex min-h-16 items-center gap-3 rounded-xl px-1 py-2 active:bg-surface-2">
        <CoverArt blob={coverTrack?.coverArt} seed={playlist.id} size={56} className="rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{playlist.name}</span>
          <span className="block text-sm text-muted">
            {count} {count === 1 ? "song" : "songs"}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 text-muted" />
      </Link>
    </li>
  );
}

export function PlaylistsScreen() {
  const { items, status } = usePlaylists();
  const { items: tracks } = useLibrary();
  const [creating, setCreating] = useState(false);
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [items],
  );
  const favouriteCount = useMemo(() => tracks.filter((t) => t.isFavorite).length, [tracks]);

  return (
    <>
      <PageHeader
        title="Playlists"
        actions={
          <Button variant="ghost" className="px-2" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-5" /> New
          </Button>
        }
      />
      <ul className="px-safe mt-4 flex flex-col">
        <li>
          <Link
            href={playlistHref(FAVORITES_PLAYLIST_ID)}
            className="flex min-h-16 items-center gap-3 rounded-xl px-1 py-2 active:bg-surface-2"
          >
            <span aria-hidden className="flex size-14 items-center justify-center rounded-lg bg-accent-solid text-white">
              <Heart className="size-7 fill-current" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Favourites</span>
              <span className="block text-sm text-muted">
                {favouriteCount} {favouriteCount === 1 ? "song" : "songs"}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-muted" />
          </Link>
        </li>
        {sorted.map((playlist) => (
          <PlaylistRow key={playlist.id} playlist={playlist} />
        ))}
      </ul>

      {status === "ready" && items.length === 0 && (
        <EmptyState
          icon={<ListMusic className="size-8" />}
          title="No playlists yet"
          message="Group songs for focus, sleep, workouts or anything else."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create Playlist
            </Button>
          }
        />
      )}

      {creating && (
        <PlaylistNameSheet
          open
          title="New Playlist"
          submitLabel="Create"
          onSubmit={(name) => createPlaylist(name)}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
