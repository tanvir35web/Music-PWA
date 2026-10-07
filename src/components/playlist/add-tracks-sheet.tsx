"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Playlist } from "@/types/playlist";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useLibrary } from "@/hooks/use-library";
import { addTracksToPlaylist } from "@/lib/library/actions";
import { searchTracks, sortTracks } from "@/lib/library/query";
import { runAction } from "@/lib/utils/errors";

interface AddTracksSheetProps {
  playlist: Playlist;
  open: boolean;
  onClose: () => void;
}

export default function AddTracksSheet({ playlist, open, onClose }: AddTracksSheetProps) {
  const { items } = useLibrary();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const existing = useMemo(() => new Set(playlist.trackIds), [playlist.trackIds]);
  const candidates = useMemo(
    () => sortTracks(searchTracks(items, query), "title").filter((t) => !existing.has(t.id)),
    [items, query, existing],
  );

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    const ids = [...selected];
    const ok = await runAction(() => addTracksToPlaylist(playlist.id, ids), {
      success: `Added ${ids.length} ${ids.length === 1 ? "song" : "songs"}.`,
    });
    if (ok) onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${playlist.name}`}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs"
          aria-label="Search songs to add"
          className="min-h-11 w-full rounded-xl bg-surface-2 pl-9 pr-3 text-base"
        />
      </div>
      {candidates.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {items.length === existing.size ? "Every song is already in this playlist." : "No matching songs."}
        </p>
      ) : (
        <ul aria-label="Songs" className="mt-2 flex flex-col">
          {candidates.map((track) => (
            <li key={track.id} className="[contain-intrinsic-size:auto_56px] [content-visibility:auto]">
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-1">
                <input
                  type="checkbox"
                  checked={selected.has(track.id)}
                  onChange={() => toggle(track.id)}
                  className="size-5 shrink-0 accent-[var(--accent-solid)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{track.title}</span>
                  <span className="block truncate text-sm text-muted">{track.artist ?? "Unknown artist"}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="sticky bottom-0 bg-surface pt-3">
        <Button variant="primary" block disabled={selected.size === 0} onClick={save}>
          {selected.size > 0 ? `Add ${selected.size} ${selected.size === 1 ? "song" : "songs"}` : "Select songs"}
        </Button>
      </div>
    </Sheet>
  );
}
