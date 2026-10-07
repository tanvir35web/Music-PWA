import type { MediaElement } from "@/lib/audio/audio-engine";

/**
 * Minimal stand-in for HTMLAudioElement. `play()` resolves and fires the
 * same events a browser would; tests drive time and `ended` manually.
 */
export class FakeMedia extends EventTarget implements MediaElement {
  src = "";
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  volume = 1;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  playError: Error | null = null;
  playCalls = 0;

  async play(): Promise<void> {
    this.playCalls++;
    if (this.playError) throw this.playError;
    this.paused = false;
    this.fire("play");
    this.fire("playing");
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.fire("pause");
  }

  load(): void {}

  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }

  fire(type: string): void {
    this.dispatchEvent(new Event(type));
  }

  /** Simulates the browser reading metadata for the current source. */
  loadMetadata(duration: number): void {
    this.duration = duration;
    this.fire("loadedmetadata");
  }

  finish(): void {
    this.currentTime = this.duration;
    this.paused = true;
    this.fire("pause");
    this.fire("ended");
  }
}
