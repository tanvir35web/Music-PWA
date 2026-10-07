"use client";

import { useState, useSyncExternalStore } from "react";
import { Share, X } from "lucide-react";
import { IconButton } from "@/components/ui/button";

const DISMISSED_KEY = "install-hint-dismissed";
const noopSubscribe = () => () => {};

function shouldShowHint(): boolean {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Storage unavailable (private mode); show the hint.
  }
  return isIOS && !standalone && !dismissed;
}

/** Explains Add to Home Screen to iPhone users browsing in Safari. */
export function InstallHint() {
  const eligible = useSyncExternalStore(noopSubscribe, shouldShowHint, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!eligible || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ignore; the hint simply returns next time.
    }
  };

  return (
    <aside className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      <Share aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
      <p className="flex-1 text-sm">
        <strong className="font-semibold">Install this app:</strong> tap the Share button, then{" "}
        <strong className="font-semibold">Add to Home Screen</strong>. It opens full screen and keeps
        your music available offline.
      </p>
      <IconButton label="Dismiss install hint" onClick={dismiss} className="-m-2 text-muted">
        <X aria-hidden className="size-4" />
      </IconButton>
    </aside>
  );
}
