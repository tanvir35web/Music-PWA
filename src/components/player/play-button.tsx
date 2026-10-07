"use client";

import { LoaderCircle, Pause, Play } from "lucide-react";
import { IconButton, type IconButtonProps } from "@/components/ui/button";
import { player, usePlayerState } from "@/hooks/use-player";
import { cn } from "@/lib/utils/cn";

interface PlayButtonProps extends Omit<IconButtonProps, "label" | "onClick"> {
  title?: string;
  iconClassName?: string;
}

export function PlayButton({ title, iconClassName, className, ...props }: PlayButtonProps) {
  const { isPlaying, isLoading, currentTrackId } = usePlayerState();
  const label = `${isPlaying ? "Pause" : "Play"}${title ? ` ${title}` : ""}`;
  const icon = cn("fill-current", iconClassName);
  return (
    <IconButton
      label={label}
      onClick={player.togglePlay}
      disabled={!currentTrackId}
      className={className}
      {...props}
    >
      {isLoading ? (
        <LoaderCircle aria-hidden className={cn("animate-spin", iconClassName)} />
      ) : isPlaying ? (
        <Pause aria-hidden className={icon} />
      ) : (
        <Play aria-hidden className={icon} />
      )}
    </IconButton>
  );
}
