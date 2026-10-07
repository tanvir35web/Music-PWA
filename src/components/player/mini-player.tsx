"use client";

import Link from "next/link";
import { SkipForward } from "lucide-react";
import { CoverArt } from "@/components/ui/cover-art";
import { IconButton } from "@/components/ui/button";
import { player, useCurrentTrack, usePlayerState } from "@/hooks/use-player";
import { PlayButton } from "./play-button";
import { ProgressLine } from "./seek-bar";

/** Persistent player above the tab bar. Tapping it opens the full player. */
export function MiniPlayer() {
  const track = useCurrentTrack();
  const { error } = usePlayerState();
  if (!track) return null;

  return (
    <div
      className="fixed inset-x-0 z-30 px-2"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 0.5rem)" }}
    >
      <div className="relative mx-auto flex h-[var(--mini-height)] max-w-2xl items-center gap-1 rounded-2xl border border-border bg-chrome pl-2 pr-1 shadow-lg backdrop-blur-xl">
        <Link
          href="/player"
          className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-xl"
          aria-label={`Now playing: ${track.title}${track.artist ? ` by ${track.artist}` : ""}. Open player`}
        >
          <CoverArt blob={track.coverArt} seed={track.id} size={44} className="rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{track.title}</span>
            <span className={error ? "block truncate text-xs text-danger" : "block truncate text-xs text-muted"}>
              {error ? "Unable to play this track" : (track.artist ?? "Unknown artist")}
            </span>
          </span>
        </Link>
        <PlayButton title={track.title} iconClassName="size-6" />
        <IconButton label="Next track" onClick={player.next}>
          <SkipForward aria-hidden className="size-6 fill-current" />
        </IconButton>
        <ProgressLine />
      </div>
    </div>
  );
}
