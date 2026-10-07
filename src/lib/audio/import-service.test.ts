import { describe, expect, it, vi } from "vitest";
import { getAllTracks, getAudioBlob } from "@/lib/db/tracks-repository";
import { makeFile, makeMp3 } from "@/test/fixtures";
import { ImportError } from "./import-errors";
import { importAudioFile, importRemoteAudio, type ImportProgress } from "./import-service";
import { DirectUrlAudioSource } from "./remote-source";

async function expectImportError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ImportError);
  expect((error as ImportError).code).toBe(code);
  return error as ImportError;
}

describe("importAudioFile", () => {
  it("imports a valid MP3 with its tags and stores the audio", async () => {
    const file = makeFile(makeMp3({ title: "Blue", artist: "Ada", album: "Colours" }), "x.mp3", "audio/mpeg");
    const stages: ImportProgress["stage"][] = [];

    const track = await importAudioFile(file, { onProgress: (p) => stages.push(p.stage) });

    expect(track).toMatchObject({
      title: "Blue",
      artist: "Ada",
      album: "Colours",
      mimeType: "audio/mpeg",
      size: file.size,
      isFavorite: false,
      playCount: 0,
    });
    expect(track.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(stages.at(-1)).toBe("done");
    expect(await getAllTracks()).toHaveLength(1);
    expect((await getAudioBlob(track.id))?.size).toBe(file.size);
  });

  it("falls back to the file name when there are no tags", async () => {
    const track = await importAudioFile(makeFile(makeMp3(), "03 - Nina - Lullaby.mp3", ""));
    expect(track).toMatchObject({ title: "Lullaby", artist: "Nina", mimeType: "audio/mpeg" });
  });

  it("detects audio when iOS reports an empty MIME type", async () => {
    const track = await importAudioFile(makeFile(makeMp3({ title: "T" }), "voice", ""));
    expect(track.mimeType).toBe("audio/mpeg");
  });

  it("rejects a non-audio file", async () => {
    await expectImportError(importAudioFile(makeFile("hello world", "notes.txt", "text/plain")), "unsupported");
    await expectImportError(importAudioFile(makeFile("<html>", "song.mp3", "text/html")), "unsupported");
    expect(await getAllTracks()).toHaveLength(0);
  });

  it("rejects an oversized file", async () => {
    const file = makeFile(makeMp3(), "big.mp3", "audio/mpeg");
    const error = await expectImportError(importAudioFile(file, { maxBytes: 100 }), "too-large");
    expect(error.message).toContain("limit");
  });

  it("rejects an empty file", async () => {
    await expectImportError(importAudioFile(makeFile(new Uint8Array(), "e.mp3", "audio/mpeg")), "empty");
  });

  it("rejects the same file imported twice", async () => {
    const bytes = makeMp3({ title: "Once" });
    await importAudioFile(makeFile(bytes, "once.mp3", "audio/mpeg"));
    const error = await expectImportError(
      importAudioFile(makeFile(bytes, "once.mp3", "audio/mpeg")),
      "duplicate",
    );
    expect(error.existing?.title).toBe("Once");
  });

  it("rejects identical content under a different name", async () => {
    const bytes = makeMp3({ title: "Same" });
    await importAudioFile(makeFile(bytes, "a.mp3", "audio/mpeg", 1));
    await expectImportError(importAudioFile(makeFile(bytes, "b.mp3", "audio/mpeg", 2)), "duplicate");
    expect(await getAllTracks()).toHaveLength(1);
  });
});

describe("importRemoteAudio", () => {
  function sourceReturning(response: Response | Error) {
    const fetchImpl = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    return { fetchImpl, source: new DirectUrlAudioSource(fetchImpl as unknown as typeof fetch, "https:") };
  }

  it("downloads and imports an authorised audio URL", async () => {
    const { source } = sourceReturning(
      new Response(makeMp3() as BlobPart, { headers: { "content-type": "audio/mpeg" } }),
    );
    const track = await importRemoteAudio("https://example.com/audio/My%20Song.mp3", { source });
    expect(track.title).toBe("My Song");
    expect(track.source).toEqual({ kind: "url", url: "https://example.com/audio/My%20Song.mp3" });
  });

  it("rejects invalid and non-http URLs", async () => {
    const { source, fetchImpl } = sourceReturning(new Response(""));
    await expectImportError(importRemoteAudio("not a url", { source }), "invalid-url");
    await expectImportError(importRemoteAudio("ftp://example.com/a.mp3", { source }), "invalid-url");
    await expectImportError(importRemoteAudio("http://example.com/a.mp3", { source }), "invalid-url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses YouTube links without fetching", async () => {
    const { source, fetchImpl } = sourceReturning(new Response(""));
    await expectImportError(importRemoteAudio("https://www.youtube.com/watch?v=abc", { source }), "not-permitted");
    await expectImportError(importRemoteAudio("https://youtu.be/abc", { source }), "not-permitted");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects web pages", async () => {
    const { source } = sourceReturning(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    await expectImportError(importRemoteAudio("https://example.com/page", { source }), "unsupported");
  });

  it("reports HTTP errors", async () => {
    const { source } = sourceReturning(new Response("", { status: 404 }));
    const error = await expectImportError(importRemoteAudio("https://example.com/a.mp3", { source }), "http");
    expect(error.message).toContain("404");
  });

  it("explains CORS/network failures", async () => {
    const { source } = sourceReturning(new TypeError("Failed to fetch"));
    const error = await expectImportError(importRemoteAudio("https://example.com/a.mp3", { source }), "network");
    expect(error.message).toContain("Unable to download this audio");
  });

  it("enforces the size limit from Content-Length", async () => {
    const { source } = sourceReturning(
      new Response(makeMp3() as BlobPart, {
        headers: { "content-type": "audio/mpeg", "content-length": "999999" },
      }),
    );
    await expectImportError(importRemoteAudio("https://example.com/a.mp3", { source, maxBytes: 1000 }), "too-large");
  });

  it("rejects a URL that was already imported", async () => {
    const first = sourceReturning(new Response(makeMp3({ title: "A" }) as BlobPart));
    await importRemoteAudio("https://example.com/a.mp3#t=1", { source: first.source });
    const second = sourceReturning(new Response(makeMp3({ title: "B" }) as BlobPart));
    await expectImportError(importRemoteAudio("https://example.com/a.mp3", { source: second.source }), "duplicate");
    expect(second.fetchImpl).not.toHaveBeenCalled();
  });
});
