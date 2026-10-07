"use client";

import { useSyncExternalStore } from "react";
import { settingsStore } from "@/lib/settings/settings-store";

export function useSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}
