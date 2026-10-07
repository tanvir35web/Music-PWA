"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Music, Search, Shuffle, X } from "lucide-react";
import type { TrackSort } from "@/types/track";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { InstallHint } from "@/components/pwa/install-hint";
import { useLibrary, useLibraryView, type LibraryFilter } from "@/hooks/use-library";
import { player } from "@/hooks/use-player";
import { recentlyPlayed } from "@/lib/library/query";
import { RecentlyPlayed } from "./recently-played";
import { TrackList } from "./track-list";

const SORT_OPTIONS: ReadonlyArray<{ value: TrackSort; label: string }> = [
  { value: "recent", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
];

const FILTER_OPTIONS: ReadonlyArray<{ value: LibraryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favourites" },
  { value: "recent", label: "Recent" },
];

export function LibraryScreen() {
  const { items, status } = useLibrary();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TrackSort>("recent");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const tracks = useLibraryView(query, sort, filter);
  const recent = useMemo(() => recentlyPlayed(items, 10), [items]);

  const count = items.length;
  const subtitle =
    status === "ready" || count > 0 ? `${count} ${count === 1 ? "song" : "songs"}` : "Loading…";

  return (
    <>
      <PageHeader title="Library" subtitle={subtitle} />
      <InstallHint />

      {status === "ready" && count === 0 ? (
        <EmptyState
          icon={<Music className="size-8" />}
          title="No music yet"
          message="Import audio files from your device. They're stored locally and play without an internet connection."
          action={
            <Link
              href="/add"
              className="inline-flex min-h-11 items-center rounded-xl bg-accent-solid px-5 font-semibold text-white"
            >
              Add Music
            </Link>
          }
        />
      ) : (
        <>
          <div className="px-safe mt-3 flex flex-col gap-3">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, artists, albums"
                aria-label="Search your library"
                enterKeyHint="search"
                autoComplete="off"
                className="min-h-11 w-full rounded-xl bg-surface-2 pl-9 pr-10 text-base placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </div>
            <Segmented label="Show" value={filter} options={FILTER_OPTIONS} onChange={setFilter} />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="flex-1"
                disabled={tracks.length === 0}
                onClick={() => player.playQueue(tracks.map((t) => t.id), { shuffle: true })}
              >
                <Shuffle aria-hidden className="size-4" /> Shuffle
              </Button>
              {filter !== "recent" && (
                <label className="relative flex min-h-11 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 text-[15px] font-semibold">
                  <ArrowUpDown aria-hidden className="size-4 text-muted" />
                  <span className="sr-only">Sort by</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as TrackSort)}
                    className="w-full appearance-none bg-transparent outline-none"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {filter === "all" && !query && recent.length > 0 && <RecentlyPlayed tracks={recent} />}

          <section aria-label="Songs" className="mt-2">
            {tracks.length === 0 && status === "ready" ? (
              <p className="px-safe py-10 text-center text-sm text-muted">
                {query
                  ? `No songs match "${query}".`
                  : filter === "favorites"
                    ? "Tap the heart on a song to add it to Favourites."
                    : "Songs you play will appear here."}
              </p>
            ) : (
              <TrackList tracks={tracks} label="Songs" />
            )}
          </section>
        </>
      )}
    </>
  );
}
