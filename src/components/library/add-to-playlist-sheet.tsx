"use client";

import { useState, type FormEvent } from "react";
import { Check, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { usePlaylists } from "@/hooks/use-playlists";
import { addTracksToPlaylist, createPlaylist } from "@/lib/library/actions";
import { runAction } from "@/lib/utils/errors";
import { firstIssue, PLAYLIST_NAME_MAX, playlistNameSchema } from "@/lib/validation";

interface AddToPlaylistSheetProps {
  trackIds: string[];
  open: boolean;
  onClose: () => void;
}

export default function AddToPlaylistSheet({ trackIds, open, onClose }: AddToPlaylistSheetProps) {
  const { items: playlists } = usePlaylists();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sorted = [...playlists].sort((a, b) => b.updatedAt - a.updatedAt);

  async function addTo(playlistId: string, playlistName: string) {
    const ok = await runAction(() => addTracksToPlaylist(playlistId, trackIds), {
      success: `Added to ${playlistName}.`,
    });
    if (ok) onClose();
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const validation = firstIssue(playlistNameSchema.safeParse(name));
    if (validation) {
      setError(validation);
      return;
    }
    const ok = await runAction(() => createPlaylist(name, trackIds), {
      success: `Created ${name.trim()}.`,
    });
    if (ok) onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add to playlist">
      <form onSubmit={create} className="mb-4 flex flex-col gap-2" noValidate>
        <label htmlFor="new-playlist-name" className="text-sm font-medium text-muted">
          New playlist
        </label>
        <div className="flex gap-2">
          <input
            id="new-playlist-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={PLAYLIST_NAME_MAX}
            placeholder="Playlist name"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "new-playlist-error" : undefined}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-base"
          />
          <Button type="submit" variant="primary">
            Create
          </Button>
        </div>
        {error && (
          <p id="new-playlist-error" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      {sorted.length > 0 && (
        <ul aria-label="Your playlists" className="flex flex-col">
          {sorted.map((playlist) => {
            const containsAll = trackIds.every((id) => playlist.trackIds.includes(id));
            return (
              <li key={playlist.id}>
                <button
                  type="button"
                  onClick={() => addTo(playlist.id, playlist.name)}
                  disabled={containsAll}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-surface-2 disabled:opacity-60"
                >
                  <ListMusic aria-hidden className="size-5 text-muted" />
                  <span className="flex-1 truncate">{playlist.name}</span>
                  <span className="text-sm text-muted">
                    {containsAll ? (
                      <span className="inline-flex items-center gap-1">
                        <Check aria-hidden className="size-4" /> Added
                      </span>
                    ) : (
                      `${playlist.trackIds.length} songs`
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
