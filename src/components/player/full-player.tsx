"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  Ellipsis,
  Heart,
  ListMusic,
  Music,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { RepeatMode } from "@/types/player";
import { Button, IconButton } from "@/components/ui/button";
import { CoverArt } from "@/components/ui/cover-art";
import { EmptyState } from "@/components/ui/empty-state";
import { openTrackMenu } from "@/components/library/track-menu";
import { player, useCurrentTrack, usePlayerState } from "@/hooks/use-player";
import { toggleFavorite } from "@/lib/library/actions";
import { runAction } from "@/lib/utils/errors";
import { cn } from "@/lib/utils/cn";
import { PlayButton } from "./play-button";
import { SeekBar } from "./seek-bar";

const QueueSheet = dynamic(() => import("./queue-sheet"), { ssr: false });

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const REPEAT_LABEL: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat all",
  one: "Repeat one",
};

function nextSpeed(current: number): number {
  const index = SPEEDS.findIndex((s) => Math.abs(s - current) < 0.01);
  return SPEEDS[(index + 1) % SPEEDS.length];
}

export function FullPlayer() {
  const router = useRouter();
  const track = useCurrentTrack();
  const { isPlaying, repeatMode, shuffle, playbackRate, error } = usePlayerState();
  const [queueOpen, setQueueOpen] = useState(false);

  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-safe pb-[calc(var(--safe-bottom)+1.5rem)] pt-[calc(var(--safe-top)+0.5rem)]">
      <div className="flex items-center justify-between">
        <IconButton label="Close player" onClick={close}>
          <ChevronDown aria-hidden className="size-7" />
        </IconButton>
        <h1 className="text-sm font-semibold uppercase tracking-wide text-muted">Now Playing</h1>
        {track ? (
          <IconButton label={`More options for ${track.title}`} onClick={() => openTrackMenu(track.id)}>
            <Ellipsis aria-hidden className="size-6" />
          </IconButton>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {!track ? (
        <EmptyState
          icon={<Music className="size-8" />}
          title="Nothing playing"
          message="Choose a song from your library to start listening."
          action={
            <Link href="/" className="font-semibold text-accent">
              Go to Library
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-1 items-center justify-center py-6">
            <div
              className={cn(
                "overflow-hidden rounded-2xl shadow-2xl transition-transform duration-500 ease-out",
                isPlaying ? "scale-100" : "scale-[0.85]",
              )}
            >
              <CoverArt
                blob={track.coverArt}
                seed={track.id}
                size={340}
                fluid
                priority
                className="aspect-square w-[min(78vw,340px)]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold">{track.title}</h2>
              <p className="truncate text-lg text-muted">{track.artist ?? "Unknown artist"}</p>
            </div>
            <IconButton
              label={track.isFavorite ? "Remove from Favourites" : "Add to Favourites"}
              aria-pressed={track.isFavorite}
              onClick={() => void runAction(() => toggleFavorite(track.id))}
              className="text-accent"
            >
              <Heart aria-hidden className={cn("size-6", track.isFavorite && "fill-current")} />
            </IconButton>
          </div>

          {error && (
            <div role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}{" "}
              <button type="button" className="font-semibold underline" onClick={player.clearError}>
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-4">
            <SeekBar />
          </div>

          <div className="mt-2 flex items-center justify-center gap-6">
            <IconButton label="Previous track" size="lg" onClick={player.previous}>
              <SkipBack aria-hidden className="size-8 fill-current" />
            </IconButton>
            <PlayButton
              size="xl"
              title={track.title}
              iconClassName="size-9"
              className="bg-fg text-bg hover:bg-fg"
            />
            <IconButton label="Next track" size="lg" onClick={player.next}>
              <SkipForward aria-hidden className="size-8 fill-current" />
            </IconButton>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <IconButton
              label="Shuffle"
              aria-pressed={shuffle}
              onClick={player.toggleShuffle}
              className={shuffle ? "bg-accent/15 text-accent" : "text-muted"}
            >
              <Shuffle aria-hidden className="size-5" />
            </IconButton>
            <Button
              variant="secondary"
              className="min-w-16 rounded-full text-sm tabular-nums"
              aria-label={`Playback speed ${playbackRate} times. Change speed`}
              onClick={() => player.setPlaybackRate(nextSpeed(playbackRate))}
            >
              {playbackRate}×
            </Button>
            <IconButton label="Up Next" onClick={() => setQueueOpen(true)} className="text-muted">
              <ListMusic aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              label={`${REPEAT_LABEL[repeatMode]}. Change repeat mode`}
              onClick={player.cycleRepeatMode}
              className={repeatMode !== "off" ? "bg-accent/15 text-accent" : "text-muted"}
            >
              {repeatMode === "one" ? (
                <Repeat1 aria-hidden className="size-5" />
              ) : (
                <Repeat aria-hidden className="size-5" />
              )}
            </IconButton>
          </div>
        </>
      )}

      {queueOpen && <QueueSheet open onClose={() => setQueueOpen(false)} />}
    </div>
  );
}
