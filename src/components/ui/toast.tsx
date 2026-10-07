"use client";

import { useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { dismissToast, toastStore } from "@/lib/utils/toast";
import { cn } from "@/lib/utils/cn";

export function Toaster() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.get, toastStore.get);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[calc(var(--safe-top)+0.5rem)]"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : undefined}
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-lg",
          )}
        >
          {item.tone === "error" ? (
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          )}
          <p className="flex-1 leading-snug">{item.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            aria-label="Dismiss"
            className="-m-2 inline-flex size-9 items-center justify-center rounded-full text-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
