import type { Track, TrackSource } from "@/types/track";
import { createTrack, findDuplicateTrack } from "@/lib/db/tracks-repository";
import { StorageError } from "@/lib/db/indexed-db";
import { createId } from "@/lib/utils/id";
import { formatBytes } from "@/lib/utils/format";
import { MAX_IMPORT_BYTES, SNIFF_BYTES, resolveAudioType } from "./audio-formats";
import { computeContentHash, fileFingerprint, urlFingerprint } from "./fingerprint";
import { IMPORT_MESSAGES, ImportError } from "./import-errors";
import { metadataFromFileName, readAudioMetadata } from "./metadata";
import { DirectUrlAudioSource, type AudioSource } from "./remote-source";

export type ImportStage =
  | "downloading"
  | "validating"
  | "checking-duplicates"
  | "reading-metadata"
  | "saving"
  | "done";

export interface ImportProgress {
  stage: ImportStage;
  /** 0..1 for the whole import, when it can be estimated. */
  fraction: number;
}

export interface ImportOptions {
  maxBytes?: number;
  onProgress?: (progress: ImportProgress) => void;
  /** Fallback when tags don't contain a duration (browser-only probe). */
  probeDuration?: (blob: Blob) => Promise<number | undefined>;
  now?: () => number;
  signal?: AbortSignal;
}

const STAGE_FRACTION: Record<Exclude<ImportStage, "downloading">, number> = {
  validating: 0.05,
  "checking-duplicates": 0.15,
  "reading-metadata": 0.5,
  saving: 0.7,
  done: 1,
};

interface ImportInput {
  blob: Blob;
  fileName: string;
  declaredType: string;
  source: TrackSource;
  fingerprint: string;
  /** Metadata supplied by the source, used when the file has no tags. */
  hints?: { title?: string; artist?: string; album?: string };
}

export function validateSize(size: number, maxBytes = MAX_IMPORT_BYTES): void {
  if (size === 0) throw new ImportError("empty", "This file is empty.");
  if (size > maxBytes) {
    throw new ImportError(
      "too-large",
      `This file is ${formatBytes(size)}. The limit is ${formatBytes(maxBytes)} per track.`,
    );
  }
}

async function readHead(blob: Blob): Promise<Uint8Array> {
  try {
    return new Uint8Array(await blob.slice(0, SNIFF_BYTES).arrayBuffer());
  } catch (cause) {
    // iOS: the file was offloaded to iCloud or removed while selected.
    throw new ImportError("read-failed", IMPORT_MESSAGES.readFailed, { cause });
  }
}

async function rejectDuplicate(keys: { fingerprint?: string; contentHash?: string }) {
  const existing = await findDuplicateTrack(keys);
  if (existing) {
    throw new ImportError("duplicate", `"${existing.title}" is already in your library.`, {
      existing,
    });
  }
}

async function importAudio(input: ImportInput, options: ImportOptions): Promise<Track> {
  const report = (stage: Exclude<ImportStage, "downloading">) =>
    options.onProgress?.({ stage, fraction: STAGE_FRACTION[stage] });
  const throwIfAborted = () => {
    if (options.signal?.aborted) throw new ImportError("aborted", "Import cancelled.");
  };

  report("validating");
  validateSize(input.blob.size, options.maxBytes);
  const format = resolveAudioType({
    fileName: input.fileName,
    declaredType: input.declaredType,
    head: await readHead(input.blob),
  });
  if (!format.ok) throw new ImportError("unsupported", IMPORT_MESSAGES.unsupported);

  report("checking-duplicates");
  await rejectDuplicate({ fingerprint: input.fingerprint });
  let contentHash: string | undefined;
  try {
    contentHash = await computeContentHash(input.blob);
  } catch (cause) {
    throw new ImportError("read-failed", IMPORT_MESSAGES.readFailed, { cause });
  }
  if (contentHash) await rejectDuplicate({ contentHash });
  throwIfAborted();

  report("reading-metadata");
  const tags = await readAudioMetadata(input.blob, format.mimeType);
  const fromName = metadataFromFileName(input.fileName);
  let duration = tags.duration;
  if (duration === undefined && options.probeDuration) {
    duration = await options.probeDuration(input.blob).catch(() => undefined);
  }
  throwIfAborted();

  report("saving");
  const now = options.now?.() ?? Date.now();
  const track: Track = {
    id: createId(),
    title: tags.title ?? input.hints?.title ?? fromName.title ?? "Untitled",
    artist: tags.artist ?? input.hints?.artist ?? fromName.artist,
    album: tags.album ?? input.hints?.album,
    duration: duration !== undefined && Number.isFinite(duration) ? duration : undefined,
    mimeType: format.mimeType,
    size: input.blob.size,
    coverArt: tags.coverArt,
    isFavorite: false,
    playCount: 0,
    createdAt: now,
    updatedAt: now,
    source: input.source,
    fingerprint: input.fingerprint,
    contentHash,
  };
  // Store the audio with its canonical type so playback picks the right decoder.
  const audio =
    input.blob.type === format.mimeType
      ? input.blob
      : input.blob.slice(0, input.blob.size, format.mimeType);

  try {
    await createTrack(track, audio);
  } catch (cause) {
    if (cause instanceof StorageError && cause.kind !== "quota") {
      throw new ImportError("storage", cause.message, { cause });
    }
    throw new ImportError("storage", IMPORT_MESSAGES.storage, { cause });
  }
  report("done");
  return track;
}

/** Imports a file chosen with `<input type="file">`. */
export function importAudioFile(file: File, options: ImportOptions = {}): Promise<Track> {
  return importAudio(
    {
      blob: file,
      fileName: file.name,
      declaredType: file.type,
      source: { kind: "file", fileName: file.name, lastModified: file.lastModified },
      fingerprint: fileFingerprint(file),
    },
    options,
  );
}

/**
 * Downloads and imports audio from a URL the user is authorised to use.
 * The download goes directly from the browser to the audio host.
 */
export async function importRemoteAudio(
  url: string,
  options: ImportOptions & { source?: AudioSource } = {},
): Promise<Track> {
  const source = options.source ?? new DirectUrlAudioSource();
  const validUrl = source.validate(url);
  const fingerprint = urlFingerprint(validUrl);
  await rejectDuplicate({ fingerprint });

  // Downloading is most of the work: map it to 0-60%, processing to 60-100%.
  const DOWNLOAD_SHARE = 0.6;
  const result = await source.getAudio(validUrl, {
    maxBytes: options.maxBytes ?? MAX_IMPORT_BYTES,
    signal: options.signal,
    onProgress: (fraction) =>
      options.onProgress?.({ stage: "downloading", fraction: fraction * DOWNLOAD_SHARE }),
  });

  return importAudio(
    {
      blob: result.blob,
      fileName: result.fileName,
      declaredType: result.blob.type,
      source: { kind: "url", url: validUrl },
      fingerprint,
      hints: result.metadata,
    },
    {
      ...options,
      onProgress: (progress) =>
        options.onProgress?.({
          stage: progress.stage,
          fraction: DOWNLOAD_SHARE + progress.fraction * (1 - DOWNLOAD_SHARE),
        }),
    },
  );
}
