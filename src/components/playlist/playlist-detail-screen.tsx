"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ListMusic, Pencil, Play, Plus, Shuffle, Trash2 } from "lucide-react";
import { FAVORITES_PLAYLIST_ID } from "@/types/playlist";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TrackList } from "@/components/library/track-list";
import { useLibrary } from "@/hooks/use-library";
import { usePlaylists } from "@/hooks/use-playlists";
import { player } from "@/hooks/use-player";
import { deletePlaylist, renamePlaylist } from "@/lib/library/actions";
import { favourites, resolveTracks } from "@/lib/library/query";
import { runAction } from "@/lib/utils/errors";
import { formatDuration } from "@/lib/utils/format";
import { PlaylistNameSheet } from "./playlist-name-sheet";

const AddTracksSheet = dynamic(() => import("./add-tracks-sheet"), { ssr: false });

type Dialog = "rename" | "delete" | "add" | null;

export function PlaylistDetailScreen() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { items, byId, status: libraryStatus } = useLibrary();
  const { byId: playlists, status } = usePlaylists();
  const [dialog, setDialog] = useState<Dialog>(null);

  const isFavourites = id === FAVORITES_PLAYLIST_ID;
  const playlist = isFavourites ? undefined : playlists.get(id);
  const name = isFavourites ? "Favourites" : playlist?.name;
  const tracks = useMemo(
    () => (isFavourites ? favourites(items) : playlist ? resolveTracks(playlist.trackIds, byId) : []),
    [isFavourites, items, playlist, byId],
  );
  const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const context = useMemo(() => ({ playlistId: id }), [id]);

  const back = (
    <IconButton label="Back to playlists" onClick={() => router.push("/playlists")}>
      <ChevronLeft aria-hidden className="size-7 text-accent" />
    </IconButton>
  );

  if (!name) {
    const loading = status !== "ready" || libraryStatus !== "ready";
    return (
      <>
        <PageHeader title={loading ? "Loading…" : "Not found"} leading={back} />
        {!loading && (
          <EmptyState
            icon={<ListMusic className="size-8" />}
            title="Playlist not found"
            message="It may have been deleted."
            action={
              <Link href="/playlists" className="font-semibold text-accent">
                Back to Playlists
              </Link>
            }
          />
        )}
      </>
    );
  }

  const ids = tracks.map((t) => t.id);
  const subtitle = `${tracks.length} ${tracks.length === 1 ? "song" : "songs"}${
    totalSeconds > 0 ? ` · ${formatDuration(totalSeconds)}` : ""
  }`;

  return (
    <>
      <PageHeader
        title={name}
        subtitle={subtitle}
        leading={back}
        actions={
          playlist && (
            <>
              <IconButton label="Add songs" onClick={() => setDialog("add")} className="text-accent">
                <Plus aria-hidden className="size-6" />
              </IconButton>
              <IconButton label="Rename playlist" onClick={() => setDialog("rename")} className="text-accent">
                <Pencil aria-hidden className="size-5" />
              </IconButton>
              <IconButton label="Delete playlist" onClick={() => setDialog("delete")} className="text-danger">
                <Trash2 aria-hidden className="size-5" />
              </IconButton>
            </>
          )
        }
      />

      <div className="px-safe mt-4 flex gap-3">
        <Button
          variant="primary"
          className="flex-1"
          disabled={ids.length === 0}
          onClick={() => player.playQueue(ids, { startIndex: 0, shuffle: false })}
        >
          <Play aria-hidden className="size-4 fill-current" /> Play
        </Button>
        <Button
          variant="secondary"
          className="flex-1 text-accent"
          disabled={ids.length === 0}
          onClick={() => player.playQueue(ids, { shuffle: true })}
        >
          <Shuffle aria-hidden className="size-4" /> Shuffle
        </Button>
      </div>

      <section aria-label={`Songs in ${name}`} className="mt-3">
        {tracks.length === 0 ? (
          <EmptyState
            icon={<ListMusic className="size-8" />}
            title="No songs yet"
            message={
              isFavourites
                ? "Tap the heart in the player or a song's menu to add favourites."
                : "Add songs from your library to this playlist."
            }
            action={
              playlist && (
                <Button variant="primary" onClick={() => setDialog("add")}>
                  Add Songs
                </Button>
              )
            }
          />
        ) : (
          <TrackList tracks={tracks} label={`Songs in ${name}`} context={context} />
        )}
      </section>

      {playlist && dialog === "rename" && (
        <PlaylistNameSheet
          open
          title="Rename Playlist"
          submitLabel="Save"
          initialName={playlist.name}
          onSubmit={(newName) => renamePlaylist(playlist.id, newName)}
          onClose={() => setDialog(null)}
        />
      )}
      {playlist && dialog === "add" && <AddTracksSheet playlist={playlist} open onClose={() => setDialog(null)} />}
      {playlist && (
        <ConfirmDialog
          open={dialog === "delete"}
          title={`Delete "${playlist.name}"?`}
          message="The playlist will be deleted. Its songs stay in your library."
          confirmLabel="Delete Playlist"
          destructive
          onConfirm={async () => {
            const ok = await runAction(() => deletePlaylist(playlist.id), { success: "Playlist deleted." });
            if (ok) router.replace("/playlists");
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
