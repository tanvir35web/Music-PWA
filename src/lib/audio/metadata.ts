/**
 * Minimal, dependency-free tag readers for the formats people most often
 * import on iPhone: MP3 (ID3v2/ID3v1) and M4A/AAC in MP4 (iTunes `ilst`).
 * Only the needed byte ranges are read from the Blob, never the whole file.
 * Every parser is defensive: malformed tags yield partial or empty results.
 */

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  /** Seconds. */
  duration?: number;
  coverArt?: Blob;
}

const MAX_ID3_BYTES = 16 * 1024 * 1024;
const MAX_MOOV_BYTES = 32 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

async function readBytes(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function uint32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function uint24(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2];
}

function synchsafe(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] & 0x7f) << 21) |
    ((bytes[at + 1] & 0x7f) << 14) |
    ((bytes[at + 2] & 0x7f) << 7) |
    (bytes[at + 3] & 0x7f)
  );
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\0/g, " ").trim();
  return trimmed ? trimmed : undefined;
}

function sniffImageType(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  return undefined;
}

function toCover(data: Uint8Array, declaredType?: string): Blob | undefined {
  if (data.length === 0 || data.length > MAX_COVER_BYTES) return undefined;
  const type = sniffImageType(data) ?? (declaredType === "image/jpg" ? "image/jpeg" : declaredType);
  if (!type?.startsWith("image/")) return undefined;
  return new Blob([data.slice()], { type });
}

// ---------------------------------------------------------------------------
// ID3v2
// ---------------------------------------------------------------------------

/** Reverses ID3 unsynchronisation (0xFF 0x00 -> 0xFF). */
function removeUnsync(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    out[length++] = bytes[i];
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i++;
  }
  return out.subarray(0, length);
}

function decodeId3Text(encoding: number, bytes: Uint8Array): string {
  try {
    if (encoding === 1) {
      if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(bytes.subarray(2));
      }
      return new TextDecoder("utf-16le").decode(bytes);
    }
    if (encoding === 2) return new TextDecoder("utf-16be").decode(bytes);
    if (encoding === 3) return new TextDecoder("utf-8").decode(bytes);
    return new TextDecoder("iso-8859-1").decode(bytes);
  } catch {
    return "";
  }
}

/** Index just past the encoding-specific null terminator starting at `from`. */
function skipTerminated(bytes: Uint8Array, from: number, encoding: number): number {
  const wide = encoding === 1 || encoding === 2;
  for (let i = from; i < bytes.length; i += wide ? 2 : 1) {
    if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) return i + (wide ? 2 : 1);
  }
  return bytes.length;
}

function readTextFrame(data: Uint8Array): string | undefined {
  if (data.length < 2) return undefined;
  // ID3v2.4 allows several null-separated values; keep the first.
  return clean(decodeId3Text(data[0], data.subarray(1)).split("\0")[0]);
}

function readPictureFrame(data: Uint8Array, legacy: boolean): { type: number; blob?: Blob } {
  const encoding = data[0];
  let offset = 1;
  let mime: string | undefined;
  if (legacy) {
    const format = ascii(data, 1, 3).toLowerCase();
    mime = format === "png" ? "image/png" : "image/jpeg";
    offset = 4;
  } else {
    const end = skipTerminated(data, offset, 0);
    mime = ascii(data, offset, end - offset - 1).toLowerCase() || undefined;
    offset = end;
  }
  const pictureType = data[offset];
  offset = skipTerminated(data, offset + 1, encoding);
  return { type: pictureType, blob: toCover(data.subarray(offset), mime) };
}

interface Id3Result {
  metadata: AudioMetadata;
  /** Byte offset where audio data starts. */
  tagEnd: number;
}

const ID3_FRAMES: Record<string, keyof Pick<AudioMetadata, "title" | "artist" | "album">> = {
  TIT2: "title",
  TT2: "title",
  TPE1: "artist",
  TP1: "artist",
  TALB: "album",
  TAL: "album",
};

export async function readId3v2(blob: Blob): Promise<Id3Result | null> {
  const header = await readBytes(blob, 0, 10);
  if (header.length < 10 || ascii(header, 0, 3) !== "ID3") return null;

  const major = header[3];
  const flags = header[5];
  const size = synchsafe(header, 6);
  const tagEnd = 10 + size + (flags & 0x10 ? 10 : 0);
  const metadata: AudioMetadata = {};
  if (major < 2 || major > 4) return { metadata, tagEnd };

  let body = await readBytes(blob, 10, 10 + Math.min(size, MAX_ID3_BYTES));
  if (major < 4 && flags & 0x80) body = removeUnsync(body);

  let offset = 0;
  if (major >= 3 && flags & 0x40 && body.length >= 4) {
    offset = major === 3 ? 4 + uint32(body, 0) : synchsafe(body, 0);
  }

  const legacy = major === 2;
  const idLength = legacy ? 3 : 4;
  const headerLength = legacy ? 6 : 10;
  let albumArtist: string | undefined;
  let cover: { type: number; blob?: Blob } | undefined;

  while (offset + headerLength <= body.length) {
    const id = ascii(body, offset, idLength);
    if (!/^[A-Z0-9]+$/.test(id)) break; // Reached padding.

    const frameSize = legacy
      ? uint24(body, offset + 3)
      : major === 4
        ? synchsafe(body, offset + 4)
        : uint32(body, offset + 4);
    const formatFlags = legacy ? 0 : body[offset + 9];
    const start = offset + headerLength;
    const end = start + frameSize;
    if (frameSize <= 0 || end > body.length) break;
    offset = end;

    let data = body.subarray(start, end);
    if (major === 4) {
      if (formatFlags & 0x0c) continue; // Compressed or encrypted.
      if (formatFlags & 0x01) data = data.subarray(4); // Data length indicator.
      if (formatFlags & 0x02) data = removeUnsync(data);
    } else if (major === 3 && formatFlags & 0xc0) {
      continue; // Compressed or encrypted.
    }

    const field = ID3_FRAMES[id];
    if (field) {
      metadata[field] ??= readTextFrame(data);
    } else if (id === "TPE2" || id === "TP2") {
      albumArtist ??= readTextFrame(data);
    } else if (id === "TLEN" || id === "TLE") {
      const ms = Number(readTextFrame(data));
      if (Number.isFinite(ms) && ms > 0) metadata.duration ??= ms / 1000;
    } else if (id === "APIC" || id === "PIC") {
      const picture = readPictureFrame(data, legacy);
      // Prefer the front cover (type 3), otherwise the first picture.
      if (picture.blob && (!cover || (cover.type !== 3 && picture.type === 3))) {
        cover = picture;
      }
    }
  }

  metadata.artist ??= albumArtist;
  metadata.coverArt = cover?.blob;
  return { metadata, tagEnd };
}

export async function readId3v1(blob: Blob): Promise<AudioMetadata | null> {
  if (blob.size < 128) return null;
  const bytes = await readBytes(blob, blob.size - 128, blob.size);
  if (ascii(bytes, 0, 3) !== "TAG") return null;
  const text = (start: number) =>
    clean(new TextDecoder("iso-8859-1").decode(bytes.subarray(start, start + 30)));
  return { title: text(3), artist: text(33), album: text(63) };
}

// ---------------------------------------------------------------------------
// MPEG audio duration
// ---------------------------------------------------------------------------

const MPEG_SAMPLE_RATES = [44100, 48000, 32000];
const BITRATES = {
  v1l1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  v1l2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  v1l3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2l1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  v2l23: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

interface MpegFrame {
  offset: number;
  bitrate: number;
  sampleRate: number;
  samplesPerFrame: number;
  sideInfoLength: number;
}

function parseMpegFrame(bytes: Uint8Array, at: number): MpegFrame | null {
  if (bytes[at] !== 0xff || (bytes[at + 1] & 0xe0) !== 0xe0) return null;
  const versionBits = (bytes[at + 1] >> 3) & 0x03;
  const layerBits = (bytes[at + 1] >> 1) & 0x03;
  const bitrateIndex = bytes[at + 2] >> 4;
  const rateIndex = (bytes[at + 2] >> 2) & 0x03;
  if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
    return null;
  }
  const mpeg1 = versionBits === 3;
  const layer = 4 - layerBits; // 1, 2 or 3
  const divisor = mpeg1 ? 1 : versionBits === 2 ? 2 : 4;
  const table = mpeg1
    ? layer === 1 ? BITRATES.v1l1 : layer === 2 ? BITRATES.v1l2 : BITRATES.v1l3
    : layer === 1 ? BITRATES.v2l1 : BITRATES.v2l23;
  const mono = bytes[at + 3] >> 6 === 3;
  return {
    offset: at,
    bitrate: table[bitrateIndex] * 1000,
    sampleRate: MPEG_SAMPLE_RATES[rateIndex] / divisor,
    samplesPerFrame: layer === 1 ? 384 : layer === 3 && !mpeg1 ? 576 : 1152,
    sideInfoLength: mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17,
  };
}

export async function readMp3Duration(
  blob: Blob,
  audioStart: number,
  hasId3v1: boolean,
): Promise<number | undefined> {
  const bytes = await readBytes(blob, audioStart, audioStart + 64 * 1024);
  let frame: MpegFrame | null = null;
  for (let i = 0; i + 4 <= bytes.length && !frame; i++) frame = parseMpegFrame(bytes, i);
  if (!frame) return undefined;

  const xing = frame.offset + 4 + frame.sideInfoLength;
  const xingId = ascii(bytes, xing, 4);
  if ((xingId === "Xing" || xingId === "Info") && uint32(bytes, xing + 4) & 0x01) {
    const frames = uint32(bytes, xing + 8);
    if (frames > 0) return (frames * frame.samplesPerFrame) / frame.sampleRate;
  }
  const vbri = frame.offset + 4 + 32;
  if (ascii(bytes, vbri, 4) === "VBRI") {
    const frames = uint32(bytes, vbri + 14);
    if (frames > 0) return (frames * frame.samplesPerFrame) / frame.sampleRate;
  }
  // Constant bitrate estimate.
  const audioBytes = blob.size - audioStart - frame.offset - (hasId3v1 ? 128 : 0);
  return audioBytes > 0 ? (audioBytes * 8) / frame.bitrate : undefined;
}

// ---------------------------------------------------------------------------
// MP4 / M4A
// ---------------------------------------------------------------------------

interface Box {
  type: string;
  start: number; // Body start.
  end: number;
}

function* boxes(bytes: Uint8Array, start: number, end: number): Generator<Box> {
  let offset = start;
  while (offset + 8 <= end) {
    let size = uint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    let headerLength = 8;
    if (size === 1) {
      if (offset + 16 > end) return;
      size = uint32(bytes, offset + 8) * 2 ** 32 + uint32(bytes, offset + 12);
      headerLength = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerLength || offset + size > end) return;
    yield { type, start: offset + headerLength, end: offset + size };
    offset += size;
  }
}

function findBox(bytes: Uint8Array, parent: Box, type: string): Box | undefined {
  for (const box of boxes(bytes, parent.start, parent.end)) if (box.type === type) return box;
  return undefined;
}

async function findTopLevelMoov(blob: Blob): Promise<Uint8Array | null> {
  let offset = 0;
  for (let i = 0; i < 64 && offset + 8 <= blob.size; i++) {
    const header = await readBytes(blob, offset, offset + 16);
    let size = uint32(header, 0);
    const type = ascii(header, 4, 4);
    let headerLength = 8;
    if (size === 1) {
      size = uint32(header, 8) * 2 ** 32 + uint32(header, 12);
      headerLength = 16;
    } else if (size === 0) {
      size = blob.size - offset;
    }
    if (size < headerLength) return null;
    if (type === "moov") {
      if (size > MAX_MOOV_BYTES) return null;
      return readBytes(blob, offset + headerLength, offset + size);
    }
    offset += size;
  }
  return null;
}

const MP4_ITEMS: Record<string, keyof Pick<AudioMetadata, "title" | "artist" | "album">> = {
  "©nam": "title",
  "©ART": "artist",
  "©alb": "album",
};

export async function readMp4(blob: Blob): Promise<AudioMetadata> {
  const metadata: AudioMetadata = {};
  const moov = await findTopLevelMoov(blob);
  if (!moov) return metadata;
  const root: Box = { type: "moov", start: 0, end: moov.length };

  const mvhd = findBox(moov, root, "mvhd");
  if (mvhd) {
    const version = moov[mvhd.start];
    const timescale = uint32(moov, mvhd.start + (version === 1 ? 20 : 12));
    const duration =
      version === 1
        ? uint32(moov, mvhd.start + 24) * 2 ** 32 + uint32(moov, mvhd.start + 28)
        : uint32(moov, mvhd.start + 16);
    if (timescale > 0 && duration > 0) metadata.duration = duration / timescale;
  }

  const udta = findBox(moov, root, "udta");
  const meta = udta && findBox(moov, udta, "meta");
  // `meta` is a full box: skip its 4-byte version/flags.
  const ilst = meta && findBox(moov, { ...meta, start: meta.start + 4 }, "ilst");
  if (!ilst) return metadata;

  let albumArtist: string | undefined;
  for (const item of boxes(moov, ilst.start, ilst.end)) {
    const data = findBox(moov, item, "data");
    if (!data || data.end - data.start < 8) continue;
    const dataType = uint24(moov, data.start + 1);
    const payload = moov.subarray(data.start + 8, data.end);
    const field = MP4_ITEMS[item.type];
    if (field && dataType === 1) {
      metadata[field] ??= clean(new TextDecoder("utf-8").decode(payload));
    } else if (item.type === "aART" && dataType === 1) {
      albumArtist ??= clean(new TextDecoder("utf-8").decode(payload));
    } else if (item.type === "covr") {
      const declared = dataType === 14 ? "image/png" : dataType === 13 ? "image/jpeg" : undefined;
      metadata.coverArt ??= toCover(payload, declared);
    }
  }
  metadata.artist ??= albumArtist;
  return metadata;
}

// ---------------------------------------------------------------------------
// File name fallback and entry point
// ---------------------------------------------------------------------------

/** Derives a title (and possibly artist) from names like "01 - Artist - Song.mp3". */
export function metadataFromFileName(fileName: string): Pick<AudioMetadata, "title" | "artist"> {
  let base = fileName.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/_/g, " ").trim();
  const withoutNumber = base.replace(/^\d{1,3}\s*[-.)]\s*/, "");
  if (withoutNumber) base = withoutNumber;
  const parts = base.split(" - ");
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return { artist: parts[0].trim(), title: parts[1].trim() };
  }
  return { title: base || "Untitled" };
}

/** Reads tags where possible. Never throws; missing fields stay undefined. */
export async function readAudioMetadata(
  blob: Blob,
  mimeType: string,
): Promise<AudioMetadata> {
  try {
    if (mimeType === "audio/mp4") return await readMp4(blob);
    if (mimeType === "audio/mpeg" || mimeType === "audio/aac") {
      const id3 = await readId3v2(blob);
      let metadata: AudioMetadata = { ...id3?.metadata };
      const v1 = await readId3v1(blob);
      if (v1) {
        metadata = {
          ...metadata,
          title: metadata.title ?? v1.title,
          artist: metadata.artist ?? v1.artist,
          album: metadata.album ?? v1.album,
        };
      }
      if (mimeType === "audio/mpeg" && metadata.duration === undefined) {
        metadata.duration = await readMp3Duration(blob, id3?.tagEnd ?? 0, v1 !== null);
      }
      return metadata;
    }
  } catch {
    // Malformed tags must never block an import.
  }
  return {};
}
