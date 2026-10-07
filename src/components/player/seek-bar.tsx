"use client";

import { useState } from "react";
import { player, usePlaybackProgress } from "@/hooks/use-player";
import { formatDuration } from "@/lib/utils/format";

/**
 * Seek slider. While dragging, the thumb follows the finger without seeking
 * on every move; the seek happens once when the drag ends.
 */
export function SeekBar() {
  const { currentTime, duration } = usePlaybackProgress();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const value = dragValue ?? currentTime;
  const max = duration > 0 ? duration : 0;
  const fill = max > 0 ? `${Math.min(100, (value / max) * 100)}%` : "0%";

  const commit = () => {
    if (dragValue === null) return;
    player.seek(dragValue);
    setDragValue(null);
  };

  return (
    <div>
      <input
        type="range"
        className="range"
        min={0}
        max={max}
        step={0.1}
        value={Math.min(value, max)}
        disabled={max === 0}
        aria-label="Playback position"
        aria-valuetext={`${formatDuration(value)} of ${formatDuration(duration)}`}
        style={{ ["--fill" as string]: fill }}
        onChange={(e) => setDragValue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        onTouchEnd={commit}
      />
      <div aria-hidden className="-mt-2 flex justify-between text-xs tabular-nums text-muted">
        <span>{formatDuration(value)}</span>
        <span>-{formatDuration(Math.max(0, duration - value))}</span>
      </div>
    </div>
  );
}

/** Thin, non-interactive progress line for the mini player. */
export function ProgressLine() {
  const { currentTime, duration } = usePlaybackProgress();
  const percent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full bg-fg/70" style={{ width: `${percent}%` }} />
    </div>
  );
}
