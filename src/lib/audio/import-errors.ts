import type { Track } from "@/types/track";

export type ImportErrorCode =
  | "empty"
  | "too-large"
  | "unsupported"
  | "duplicate"
  | "storage"
  | "read-failed"
  | "invalid-url"
  | "not-permitted"
  | "network"
  | "http"
  | "aborted";

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  /** Set for `duplicate`: the track already in the library. */
  readonly existing?: Track;

  constructor(
    code: ImportErrorCode,
    message: string,
    options: { cause?: unknown; existing?: Track } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ImportError";
    this.code = code;
    this.existing = options.existing;
  }
}

export const IMPORT_MESSAGES = {
  storage: "Unable to save this file. Your device may not have enough available storage.",
  remote:
    "Unable to download this audio. Check the URL, network connection, and whether the server allows access.",
  unsupported: "This file isn't a supported audio format (MP3, M4A, AAC, WAV, OGG, WebM or FLAC).",
  readFailed: "This file couldn't be read. It may have been moved or is still downloading to your device.",
} as const;

