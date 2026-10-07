/** Largest single file the app will import (bytes). */
export const MAX_IMPORT_BYTES = 300 * 1024 * 1024;

/** Canonical MIME types the importer accepts. */
export const CANONICAL_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
] as const;

export type CanonicalAudioType = (typeof CANONICAL_AUDIO_TYPES)[number];

const MIME_ALIASES: Record<string, CanonicalAudioType> = {
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/mpeg3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/mp4": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/x-m4b": "audio/mp4",
  // iOS sometimes labels .m4a/.mp4 audio as video/mp4.
  "video/mp4": "audio/mp4",
  "audio/aac": "audio/aac",
  "audio/x-aac": "audio/aac",
  "audio/aacp": "audio/aac",
  "audio/wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/ogg": "audio/ogg",
  "audio/opus": "audio/ogg",
  "audio/vorbis": "audio/ogg",
  "application/ogg": "audio/ogg",
  "audio/webm": "audio/webm",
  "audio/flac": "audio/flac",
  "audio/x-flac": "audio/flac",
};

const EXTENSION_TYPES: Record<string, CanonicalAudioType> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  wave: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  weba: "audio/webm",
  flac: "audio/flac",
};

/** Value for `<input accept>`; extensions help iOS show the right files. */
export const AUDIO_ACCEPT = [
  "audio/*",
  ...Object.keys(EXTENSION_TYPES).map((ext) => `.${ext}`),
].join(",");

/** Bytes needed by `sniffAudioType`. */
export const SNIFF_BYTES = 16;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Detects common audio containers from their leading bytes. */
export function sniffAudioType(bytes: Uint8Array): CanonicalAudioType | null {
  if (bytes.length < 4) return null;
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(bytes, 0, 4) === "fLaC") return "audio/flac";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return "audio/wav";
  }
  if (bytes.length >= 8 && ascii(bytes, 4, 4) === "ftyp") return "audio/mp4";
  // MPEG audio frame sync: 11 set bits. Layer bits 00 means ADTS AAC.
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    const layer = (bytes[1] >> 1) & 0x03;
    return layer === 0 ? "audio/aac" : "audio/mpeg";
  }
  return null;
}

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

export function normaliseMimeType(type: string): CanonicalAudioType | null {
  const base = type.split(";")[0].trim().toLowerCase();
  return MIME_ALIASES[base] ?? null;
}

/** Declared types that say nothing about the content. */
function isGenericType(type: string): boolean {
  const base = type.split(";")[0].trim().toLowerCase();
  return base === "" || base === "application/octet-stream" || base === "binary/octet-stream";
}

export type FormatCheck =
  | { ok: true; mimeType: CanonicalAudioType }
  | { ok: false; reason: "unsupported" };

/**
 * Decides the audio type from the declared MIME type, the file extension and
 * the leading bytes. Content sniffing wins when it recognises the data.
 */
export function resolveAudioType(input: {
  fileName: string;
  declaredType: string;
  head: Uint8Array;
}): FormatCheck {
  const sniffed = sniffAudioType(input.head);
  const declared = normaliseMimeType(input.declaredType);
  const byExtension = EXTENSION_TYPES[extensionOf(input.fileName)] ?? null;

  // A specific non-audio type (text/html, image/png, ...) is rejected even if
  // the name ends in .mp3, unless the bytes clearly are audio.
  if (!declared && !isGenericType(input.declaredType) && !sniffed) {
    return { ok: false, reason: "unsupported" };
  }
  const mimeType = sniffed ?? declared ?? byExtension;
  return mimeType ? { ok: true, mimeType } : { ok: false, reason: "unsupported" };
}

/** Whether this browser reports it can probably decode the type. */
export function canBrowserPlay(mimeType: string): boolean {
  if (typeof document === "undefined") return true;
  const probe = document.createElement("audio");
  return probe.canPlayType(mimeType) !== "";
}
