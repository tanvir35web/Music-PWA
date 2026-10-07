type EventSource = Pick<Window, "addEventListener" | "removeEventListener">;

/** Subscribes to browser online/offline changes. Returns an unsubscribe function. */
export function subscribeOnlineStatus(
  callback: () => void,
  target: EventSource = window,
): () => void {
  target.addEventListener("online", callback);
  target.addEventListener("offline", callback);
  return () => {
    target.removeEventListener("online", callback);
    target.removeEventListener("offline", callback);
  };
}

/**
 * `navigator.onLine` is false only when the device has no network at all; a
 * true value does not guarantee the internet is reachable.
 */
export function getOnlineStatus(nav: Pick<Navigator, "onLine"> = navigator): boolean {
  return nav.onLine;
}
