const PROBE_TIMEOUT_MS = 3000;

/**
 * Asks the browser for a file's duration using a temporary audio element.
 * iOS often does not load metadata without a user gesture, so this may time
 * out; the player records the duration on first playback instead.
 */
export function probeDuration(blob: Blob): Promise<number | undefined> {
  if (typeof Audio === "undefined") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    const finish = (value: number | undefined) => {
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(undefined), PROBE_TIMEOUT_MS);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () =>
      finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined),
    );
    audio.addEventListener("error", () => finish(undefined));
    audio.src = url;
  });
}
