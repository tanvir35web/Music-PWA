"use client";

import Link from "next/link";
import { useState } from "react";
import { Music, Search, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InstallHint } from "@/components/pwa/install-hint";
import { useLibrary, useLibraryView } from "@/hooks/use-library";
import { TrackList } from "./track-list";

export function LibraryScreen() {
  const { items, status } = useLibrary();
  const [query, setQuery] = useState("");
  const tracks = useLibraryView(query, "recent");

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
          <div className="px-safe mt-3">
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
          </div>

          <section aria-label="Songs" className="mt-2">
            {tracks.length === 0 && status === "ready" ? (
              <p className="px-safe py-10 text-center text-sm text-muted">No songs match &quot;{query}&quot;.</p>
            ) : (
              <TrackList tracks={tracks} label="Songs" />
            )}
          </section>
        </>
      )}
    </>
  );
}
