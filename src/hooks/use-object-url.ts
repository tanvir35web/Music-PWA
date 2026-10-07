"use client";

import { useEffect } from "react";

interface Entry {
  url: string;
  refs: number;
}

/** One object URL per Blob, shared by every component showing it. */
const cache = new WeakMap<Blob, Entry>();
/** Grace period so StrictMode's unmount/remount doesn't revoke a live URL. */
const RELEASE_DELAY_MS = 1000;

function release(blob: Blob, entry: Entry): void {
  setTimeout(() => {
    if (entry.refs === 0 && cache.get(blob) === entry) {
      URL.revokeObjectURL(entry.url);
      cache.delete(blob);
    }
  }, RELEASE_DELAY_MS);
}

function acquire(blob: Blob): Entry {
  let entry = cache.get(blob);
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), refs: 0 };
    cache.set(blob, entry);
    // Revoke if no component ends up mounting with it (e.g. a discarded render).
    release(blob, entry);
  }
  return entry;
}

/**
 * Returns an object URL for a Blob. URLs are reference-counted and revoked
 * once no mounted component uses them, so cover art never leaks memory.
 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = blob ? acquire(blob).url : undefined;
  useEffect(() => {
    if (!blob) return;
    const entry = acquire(blob);
    entry.refs++;
    return () => {
      entry.refs--;
      release(blob, entry);
    };
  }, [blob]);
  return url;
}
