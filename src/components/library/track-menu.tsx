"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Heart, HeartOff, ListEnd, ListMinus, ListPlus, ListStart, Pencil, Trash2 } from "lucide-react";
import { FAVORITES_PLAYLIST_ID } from "@/types/playlist";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CoverArt } from "@/components/ui/cover-art";
import { Sheet } from "@/components/ui/sheet";
import { useLibrary } from "@/hooks/use-library";
import { player } from "@/hooks/use-player";
import { deleteTracks, removeTrackFromPlaylist, toggleFavorite } from "@/lib/library/actions";
import { runAction } from "@/lib/utils/errors";
import { toast } from "@/lib/utils/toast";
import { createStore } from "@/lib/utils/store";
import { cn } from "@/lib/utils/cn";

// Secondary sheets are loaded on demand.
const AddToPlaylistSheet = dynamic(() => import("./add-to-playlist-sheet"), { ssr: false });
const EditTrackSheet = dynamic(() => import("./edit-track-sheet"), { ssr: false });

export interface TrackMenuContext {
  playlistId?: string;
}

const menuStore = createStore<{ trackId: string; context?: TrackMenuContext } | null>(null);

/** Opens the shared track action sheet (long-press or "More" button). */
export function openTrackMenu(trackId: string, context?: TrackMenuContext): void {
  menuStore.set({ trackId, context });
}

type View = "menu" | "playlist" | "edit" | "delete";

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-[15px] active:bg-surface-2",
          danger && "text-danger",
        )}
      >
        <span aria-hidden className="text-muted [&>svg]:size-5">
          {icon}
        </span>
        {children}
      </button>
    </li>
  );
}

/** Rendered once in the app shell; shows the menu for whichever track was chosen. */
export function TrackMenuHost() {
  const target = useSyncExternalStore(menuStore.subscribe, menuStore.get, () => null);
  const [view, setView] = useState<View>("menu");
  const { byId } = useLibrary();
  const track = target ? byId.get(target.trackId) : undefined;

  const close = () => {
    menuStore.set(null);
    setView("menu");
  };

  if (!target || !track) return null;
  const playlistId = target.context?.playlistId;
  const inUserPlaylist = playlistId !== undefined && playlistId !== FAVORITES_PLAYLIST_ID;

  const act = (action: () => void) => {
    action();
    close();
  };

  return (
    <>
      <Sheet open={view === "menu"} onClose={close} title={`Options for ${track.title}`} hideTitle>
        <div className="mb-3 flex items-center gap-3">
          <CoverArt blob={track.coverArt} seed={track.id} size={52} className="rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{track.title}</p>
            <p className="truncate text-sm text-muted">{track.artist ?? "Unknown artist"}</p>
          </div>
        </div>
        <ul className="flex flex-col">
          <MenuItem
            icon={<ListStart />}
            onClick={() =>
              act(() => {
                player.playNext(track.id);
                toast("Playing next.", "success");
              })
            }
          >
            Play next
          </MenuItem>
          <MenuItem
            icon={<ListEnd />}
            onClick={() =>
              act(() => {
                player.addToQueue([track.id]);
                toast("Added to queue.", "success");
              })
            }
          >
            Add to queue
          </MenuItem>
          <MenuItem
            icon={track.isFavorite ? <HeartOff /> : <Heart />}
            onClick={() => act(() => void runAction(() => toggleFavorite(track.id)))}
          >
            {track.isFavorite ? "Remove from Favourites" : "Add to Favourites"}
          </MenuItem>
          <MenuItem icon={<ListPlus />} onClick={() => setView("playlist")}>
            Add to playlist…
          </MenuItem>
          {inUserPlaylist && (
            <MenuItem
              icon={<ListMinus />}
              onClick={() =>
                act(() => void runAction(() => removeTrackFromPlaylist(playlistId, track.id)))
              }
            >
              Remove from this playlist
            </MenuItem>
          )}
          <MenuItem icon={<Pencil />} onClick={() => setView("edit")}>
            Edit details…
          </MenuItem>
          <MenuItem icon={<Trash2 />} onClick={() => setView("delete")} danger>
            Delete from library…
          </MenuItem>
        </ul>
      </Sheet>

      {view === "playlist" && <AddToPlaylistSheet trackIds={[track.id]} open onClose={close} />}
      {view === "edit" && <EditTrackSheet track={track} open onClose={close} />}
      <ConfirmDialog
        open={view === "delete"}
        title={`Delete "${track.title}"?`}
        message="The audio file will be removed from this device and from all playlists. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => runAction(() => deleteTracks([track.id]), { success: "Track deleted." }).then(() => undefined)}
        onClose={close}
      />
    </>
  );
}
