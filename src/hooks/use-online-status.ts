"use client";

import { useSyncExternalStore } from "react";
import { getOnlineStatus, subscribeOnlineStatus } from "@/lib/pwa/online-status";

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (callback) => subscribeOnlineStatus(callback),
    () => getOnlineStatus(),
    () => true,
  );
}
