"use client";

import { useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyUpdate, serviceWorkerStore } from "@/lib/pwa/service-worker";

export function UpdateBanner() {
  const { updateAvailable } = useSyncExternalStore(
    serviceWorkerStore.subscribe,
    serviceWorkerStore.get,
    serviceWorkerStore.get,
  );
  if (!updateAvailable) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[calc(var(--safe-top)+0.5rem)]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2 shadow-lg">
        <RefreshCw aria-hidden className="size-5 text-accent" />
        <p className="flex-1 text-sm">A new version is available.</p>
        <Button variant="primary" className="min-h-9 px-3 text-sm" onClick={applyUpdate}>
          Reload
        </Button>
      </div>
    </div>
  );
}
