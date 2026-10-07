/** Builds a minimal MP3: an ID3v2.3 tag followed by one MPEG-1 Layer III frame. */
export function makeMp3(tags: { title?: string; artist?: string; album?: string } = {}): Uint8Array {
  const frames: number[] = [];
  const addText = (id: string, value?: string) => {
    if (!value) return;
    const text = [3, ...new TextEncoder().encode(value)]; // UTF-8 encoding byte
    frames.push(...ascii(id), ...uint32(text.length), 0, 0, ...text);
  };
  addText("TIT2", tags.title);
  addText("TPE1", tags.artist);
  addText("TALB", tags.album);

  const size = frames.length;
  const header = [
    ...ascii("ID3"), 3, 0, 0,
    (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f,
  ];
  // 128 kbps, 44.1 kHz, stereo MPEG-1 Layer III frame header + padding.
  const frame = [0xff, 0xfb, 0x90, 0x00, ...new Array(413).fill(0)];
  return new Uint8Array([...header, ...frames, ...frame]);
}

export function makeFile(
  bytes: Uint8Array | string,
  name: string,
  type: string,
  lastModified = 1_700_000_000_000,
): File {
  return new File([bytes as BlobPart], name, { type, lastModified });
}

function ascii(value: string): number[] {
  return Array.from(value, (c) => c.charCodeAt(0));
}

function uint32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
