import { describe, expect, it } from "vitest";
import { makeMp3 } from "@/test/fixtures";
import { sniffAudioType, resolveAudioType } from "./audio-formats";
import { metadataFromFileName, readAudioMetadata } from "./metadata";

describe("readAudioMetadata", () => {
  it("reads ID3v2.3 text frames and estimates MP3 duration", async () => {
    const blob = new Blob([makeMp3({ title: "Title", artist: "Artist", album: "Album" }) as BlobPart]);
    const metadata = await readAudioMetadata(blob, "audio/mpeg");
    expect(metadata).toMatchObject({ title: "Title", artist: "Artist", album: "Album" });
    expect(metadata.duration).toBeGreaterThan(0);
  });

  it("returns an empty result for garbage instead of throwing", async () => {
    const blob = new Blob([new Uint8Array([0x49, 0x44, 0x33, 9, 9, 9, 0xff, 0xff, 0xff, 0xff])]);
    await expect(readAudioMetadata(blob, "audio/mpeg")).resolves.toBeDefined();
    await expect(readAudioMetadata(new Blob(["x"]), "audio/mp4")).resolves.toEqual({});
  });
});

describe("metadataFromFileName", () => {
  it.each([
    ["01 - Artist - Song.mp3", { artist: "Artist", title: "Song" }],
    ["Artist - Song.m4a", { artist: "Artist", title: "Song" }],
    ["my_song.wav", { title: "my song" }],
    ["07. Track.mp3", { title: "Track" }],
  ])("%s", (name, expected) => {
    expect(metadataFromFileName(name)).toEqual(expected);
  });
});

describe("audio type detection", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it("sniffs common containers", () => {
    expect(sniffAudioType(new TextEncoder().encode("ID3\x03"))).toBe("audio/mpeg");
    expect(sniffAudioType(new TextEncoder().encode("\0\0\0\x20ftypM4A "))).toBe("audio/mp4");
    expect(sniffAudioType(new TextEncoder().encode("RIFF\0\0\0\0WAVE"))).toBe("audio/wav");
    expect(sniffAudioType(new TextEncoder().encode("OggS"))).toBe("audio/ogg");
    expect(sniffAudioType(bytes(0xff, 0xf1, 0x50, 0x80))).toBe("audio/aac");
    expect(sniffAudioType(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
  });

  it("uses the extension when the bytes are unrecognised", () => {
    expect(resolveAudioType({ fileName: "a.m4a", declaredType: "", head: bytes(0, 0, 0, 0) })).toEqual({
      ok: true,
      mimeType: "audio/mp4",
    });
  });

  it("rejects explicitly non-audio types", () => {
    expect(resolveAudioType({ fileName: "a.mp3", declaredType: "image/png", head: bytes(0, 0, 0, 0) }).ok).toBe(false);
  });
});
