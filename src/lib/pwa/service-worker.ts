import { createStore } from "@/lib/utils/store";

export type OfflineStatus =
  | "checking"
  | "ready" // App shell cached; works offline.
  | "installing"
  | "development" // Service worker disabled in `next dev`.
  | "insecure" // Needs HTTPS (or localhost).
  | "unsupported"
  | "error";

export const serviceWorkerStore = createStore<{
  status: OfflineStatus;
  updateAvailable: boolean;
}>({ status: "checking", updateAvailable: false });

let registration: ServiceWorkerRegistration | null = null;
let reloadOnControllerChange = false;

function setStatus(status: OfflineStatus): void {
  serviceWorkerStore.set((s) => ({ ...s, status }));
}

function watchForUpdate(reg: ServiceWorkerRegistration): void {
  const markWaiting = () => {
    // Only an *update* waits: the first install has no controller yet.
    if (reg.waiting && navigator.serviceWorker.controller) {
      serviceWorkerStore.set((s) => ({ ...s, updateAvailable: true }));
    }
  };
  markWaiting();
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") markWaiting();
      if (worker.state === "activated") setStatus("ready");
    });
  });
}

/**
 * Registers /sw.js in production builds. Updates are never applied silently
 * (that could interrupt playback); the user is offered a reload instead.
 */
export async function registerServiceWorker(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return setStatus("development");
  if (!("serviceWorker" in navigator)) return setStatus("unsupported");
  if (!window.isSecureContext) return setStatus("insecure");

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadOnControllerChange) window.location.reload();
  });

  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    watchForUpdate(registration);
    setStatus(registration.active ? "ready" : "installing");

    // Check for a new version whenever the app returns to the foreground.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    });
  } catch (error) {
    console.error("Service worker registration failed", error);
    setStatus("error");
  }
}

export async function checkForUpdate(): Promise<void> {
  if (!registration || !navigator.onLine) return;
  try {
    await registration.update();
  } catch {
    // Offline or server unreachable; try again later.
  }
}

/** Activates the waiting service worker and reloads into the new version. */
export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  reloadOnControllerChange = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}
