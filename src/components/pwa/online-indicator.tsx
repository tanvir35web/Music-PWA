"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils/cn";

export function OnlineIndicator() {
  const online = useOnlineStatus();
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        online ? "text-muted" : "bg-danger/15 text-danger",
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", online ? "bg-success" : "bg-danger")} />
      {online ? "Online" : "Offline"}
    </span>
  );
}
