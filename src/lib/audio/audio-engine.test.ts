import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMedia } from "@/test/fake-media";
import { AudioEngine, MISSING_AUDIO_ERROR, PLAYBACK_ERROR, shuffleIds } from "./audio-engine";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(options: { missing?: string[]; unlockSrc?: string } = {}) {
  const media = new FakeMedia();
  let urlCounter = 0;
  const created: string[] = [];
  const revoked: string[] = [];
  const engine = new AudioEngine({
    media,
    loadAudio: async (id) =>
      options.missing?.includes(id) ? undefined : new Blob([id], { type: "audio/mpeg" }),
    describeTrack: (id) => ({ title: `Title ${id}`, duration: 100 }),
    createObjectUrl: () => {
      const url = `blob:${++urlCounter}`;
      created.push(url);
      return url;
    },
    revokeObjectUrl: (url) => revoked.push(url),
    random: () => 0,
    unlockSrc: options.unlockSrc,
  });
  return { media, engine, created, revoked };
}

describe("AudioEngine", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("plays a queue from the chosen track", async () => {
    ctx.engine.playQueue(["a", "b", "c"], { startIndex: 1 });
    await flush();
    const state = ctx.engine.getState();
    expect(state).toMatchObject({ currentTrackId: "b", queueIndex: 1, isPlaying: true, isLoading: false });
    expect(ctx.media.src).toBe("blob:1");
  });

  it("pauses and resumes", async () => {
    ctx.engine.playQueue(["a"]);
    await flush();
    ctx.engine.togglePlay();
    expect(ctx.engine.getState().isPlaying).toBe(false);
    expect(ctx.media.paused).toBe(true);
    ctx.engine.togglePlay();
    await flush();
    expect(ctx.engine.getState().isPlaying).toBe(true);
  });

  it("goes to the next and previous tracks", async () => {
    ctx.engine.playQueue(["a", "b", "c"]);
    await flush();
    ctx.engine.next();
    await flush();
    expect(ctx.engine.getState().currentTrackId).toBe("b");
    ctx.engine.previous();
    await flush();
    expect(ctx.engine.getState().currentTrackId).toBe("a");
  });

  it("restarts the current track when previous is pressed after 3 seconds", async () => {
    ctx.engine.playQueue(["a", "b"], { startIndex: 1 });
    await flush();
    ctx.media.loadMetadata(100);
    ctx.media.currentTime = 30;
    ctx.engine.previous();
    expect(ctx.engine.getState().currentTrackId).toBe("b");
    expect(ctx.media.currentTime).toBe(0);
  });

  it("stops at the end of the queue when repeat is off", async () => {
    ctx.engine.playQueue(["a", "b"], { startIndex: 1 });
    await flush();
    ctx.media.loadMetadata(100);
    ctx.media.finish();
    await flush();
    expect(ctx.engine.getState()).toMatchObject({ currentTrackId: "b", isPlaying: false });
  });

  it("advances automatically when a track ends", async () => {
    ctx.engine.playQueue(["a", "b"]);
    await flush();
    ctx.media.finish();
    await flush();
    expect(ctx.engine.getState()).toMatchObject({ currentTrackId: "b", isPlaying: true });
  });

  it("does not advance when autoplay is disabled", async () => {
    ctx.engine.setAutoplay(false);
    ctx.engine.playQueue(["a", "b"]);
    await flush();
    ctx.media.finish();
    await flush();
    expect(ctx.engine.getState()).toMatchObject({ currentTrackId: "a", isPlaying: false });
  });

  it("wraps around with repeat all", async () => {
    ctx.engine.setRepeatMode("all");
    ctx.engine.playQueue(["a", "b"], { startIndex: 1 });
    await flush();
    ctx.media.finish();
    await flush();
    expect(ctx.engine.getState().currentTrackId).toBe("a");
    ctx.engine.previous();
    await flush();
    expect(ctx.engine.getState().currentTrackId).toBe("b");
  });

  it("replays the same track with repeat one and counts each play", async () => {
    const starts: string[] = [];
    ctx.engine.on("trackstart", (id) => starts.push(id));
    ctx.engine.setRepeatMode("one");
    ctx.engine.playQueue(["a", "b"]);
    await flush();
    ctx.media.loadMetadata(100);
    ctx.media.finish();
    await flush();
    expect(ctx.engine.getState()).toMatchObject({ currentTrackId: "a", isPlaying: true });
    expect(ctx.media.currentTime).toBe(0);
    expect(starts).toEqual(["a", "a"]);
  });

  it("cycles repeat modes off -> all -> one -> off", () => {
    const modes = [1, 2, 3].map(() => {
      ctx.engine.cycleRepeatMode();
      return ctx.engine.getState().repeatMode;
    });
    expect(modes).toEqual(["all", "one", "off"]);
  });

  it("shuffles with the current track first and restores the original order", async () => {
    ctx.engine.playQueue(["a", "b", "c", "d"], { startIndex: 2 });
    await flush();
    ctx.engine.setShuffle(true);
    let state = ctx.engine.getState();
    expect(state.queue[0]).toBe("c");
    expect([...state.queue].sort()).toEqual(["a", "b", "c", "d"]);
    expect(state.queueIndex).toBe(0);

    ctx.engine.setShuffle(false);
    state = ctx.engine.getState();
    expect(state.queue).toEqual(["a", "b", "c", "d"]);
    expect(state.queueIndex).toBe(2);
  });

  it("plays a shuffled playlist from a random start", async () => {
    ctx.engine.playQueue(["a", "b", "c"], { shuffle: true });
    await flush();
    const state = ctx.engine.getState();
    expect(state.shuffle).toBe(true);
    expect(state.queue).toEqual(shuffleIds(["a", "b", "c"], () => 0));
    expect(state.currentTrackId).toBe(state.queue[0]);
  });

  it("seeks within the track and clamps to its duration", async () => {
    ctx.engine.playQueue(["a"]);
    await flush();
    ctx.media.loadMetadata(100);
    ctx.engine.seek(42);
    expect(ctx.media.currentTime).toBe(42);
    expect(ctx.engine.getProgress()).toEqual({ currentTime: 42, duration: 100 });
    ctx.engine.seek(500);
    expect(ctx.media.currentTime).toBe(100);
    ctx.engine.seekBy(-200);
    expect(ctx.media.currentTime).toBe(0);
  });

  it("revokes the previous Blob URL when the track changes", async () => {
    ctx.engine.playQueue(["a", "b", "c"]);
    await flush();
    ctx.engine.next();
    await flush();
    ctx.engine.next();
    await flush();
    expect(ctx.created).toEqual(["blob:1", "blob:2", "blob:3"]);
    expect(ctx.revoked).toEqual(["blob:1", "blob:2"]);
    ctx.engine.unload();
    expect(ctx.revoked).toEqual(["blob:1", "blob:2", "blob:3"]);
  });

  it("ignores a slow load that a newer selection superseded", async () => {
    ctx.engine.playQueue(["a", "b"]);
    ctx.engine.playQueue(["a", "b"], { startIndex: 1 });
    await flush();
    expect(ctx.engine.getState().currentTrackId).toBe("b");
    expect(ctx.created).toHaveLength(1);
  });

  it("reports missing audio without throwing", async () => {
    const { engine } = setup({ missing: ["a"] });
    engine.playQueue(["a"]);
    await flush();
    expect(engine.getState()).toMatchObject({ error: MISSING_AUDIO_ERROR, isPlaying: false });
  });

  it("reports decode errors", async () => {
    ctx.engine.playQueue(["a"]);
    await flush();
    ctx.media.fire("error");
    expect(ctx.engine.getState().error).toBe(PLAYBACK_ERROR);
  });

  it("treats NotAllowedError as paused rather than an error", async () => {
    ctx.media.playError = Object.assign(new Error("blocked"), { name: "NotAllowedError" });
    ctx.engine.playQueue(["a"]);
    await flush();
    expect(ctx.engine.getState()).toMatchObject({ isPlaying: false, error: null });
  });

  it("removes deleted tracks and stops if the current one was deleted", async () => {
    ctx.engine.playQueue(["a", "b", "c"], { startIndex: 1 });
    await flush();
    ctx.engine.removeTracks(["a"]);
    expect(ctx.engine.getState()).toMatchObject({ queue: ["b", "c"], queueIndex: 0, currentTrackId: "b" });
    ctx.engine.removeTracks(["b"]);
    expect(ctx.engine.getState()).toMatchObject({ queue: ["c"], currentTrackId: null, isPlaying: false });
  });

  it("restores the last session and resumes at the saved position on play", async () => {
    ctx.engine.restore({ queue: ["a", "b"], trackId: "b", position: 37 });
    expect(ctx.engine.getState()).toMatchObject({ currentTrackId: "b", isPlaying: false });
    expect(ctx.engine.getProgress().currentTime).toBe(37);
    expect(ctx.media.src).toBe("");

    ctx.engine.play();
    await flush();
    ctx.media.loadMetadata(100);
    expect(ctx.media.currentTime).toBe(37);
    expect(ctx.engine.getState().isPlaying).toBe(true);
  });

  it("keeps the playback rate across track changes", async () => {
    ctx.engine.setPlaybackRate(1.5);
    expect(ctx.media.defaultPlaybackRate).toBe(1.5);
    expect(ctx.engine.getState().playbackRate).toBe(1.5);
  });

  it("plays the unlock clip synchronously on the first gesture only", async () => {
    const { engine, media } = setup({ unlockSrc: "data:silence" });
    const play = vi.spyOn(media, "play");
    engine.playQueue(["a"]);
    // Synchronous: before any await, the silent clip is already playing.
    expect(play).toHaveBeenCalledTimes(1);
    expect(media.src).toBe("data:silence");
    await flush();
    expect(media.src).toBe("blob:1");
    engine.playQueue(["a", "b"], { startIndex: 1 });
    await flush();
    expect(play).toHaveBeenCalledTimes(3);
  });

  it("reports the duration once per load", async () => {
    const durations: number[] = [];
    ctx.engine.on("duration", (_, d) => durations.push(d));
    ctx.engine.playQueue(["a"]);
    await flush();
    ctx.media.loadMetadata(120);
    ctx.media.fire("durationchange");
    expect(durations).toEqual([120]);
  });
});

describe("AudioEngine.playAt", () => {
  it("jumps within the queue without changing its order or shuffle", async () => {
    const { engine } = setup();
    engine.playQueue(["a", "b", "c"]);
    engine.setShuffle(true);
    await flush();
    const before = engine.getState().queue;
    engine.playAt(2);
    await flush();
    expect(engine.getState()).toMatchObject({ queue: before, queueIndex: 2, shuffle: true, currentTrackId: before[2] });
  });
});
