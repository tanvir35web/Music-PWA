import { z } from "zod";
import { formatBytes } from "@/lib/utils/format";
import { MAX_IMPORT_BYTES, normaliseMimeType } from "./audio-formats";
import { IMPORT_MESSAGES, ImportError } from "./import-errors";

export interface RemoteAudio {
  blob: Blob;
  fileName: string;
  metadata?: { title?: string; artist?: string; album?: string };
}

export interface GetAudioOptions {
  signal?: AbortSignal;
  /** 0..1 when the server reports Content-Length. */
  onProgress?: (fraction: number) => void;
  maxBytes?: number;
}

/**
 * A source of audio the user is authorised to download. Implementations must
 * only fetch content the user has the right to store and play.
 */
export interface AudioSource {
  /** Returns a normalised URL or throws an ImportError explaining why not. */
  validate(url: string): string;
  getAudio(url: string, options?: GetAudioOptions): Promise<RemoteAudio>;
}

/**
 * Streaming and video platforms whose terms do not permit downloading. Links
 * to them are refused outright rather than attempting any extraction.
 */
const BLOCKED_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com"];

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

const urlInputSchema = z.string().trim().min(1, "Paste a link to an audio file.");

export function validateRemoteUrl(raw: string, pageProtocol?: string): string {
  const input = urlInputSchema.safeParse(raw);
  if (!input.success) {
    throw new ImportError("invalid-url", input.error.issues[0]?.message ?? "Invalid link.");
  }
  let url: URL;
  try {
    url = new URL(input.data);
  } catch {
    throw new ImportError("invalid-url", "That doesn't look like a valid link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportError("invalid-url", "Only http:// and https:// links are supported.");
  }
  if (url.protocol === "http:" && pageProtocol === "https:") {
    throw new ImportError(
      "invalid-url",
      "Use an https:// link. Browsers block http:// downloads from secure pages.",
    );
  }
  if (url.username || url.password) {
    throw new ImportError("invalid-url", "Links containing a username or password aren't supported.");
  }
  if (isBlockedHost(url.hostname)) {
    throw new ImportError(
      "not-permitted",
      "YouTube links aren't supported. Use a direct link to an audio file you have permission to download.",
    );
  }
  return url.href;
}

function fileNameFrom(response: Response, url: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  const segment = new URL(response.url || url).pathname.split("/").filter(Boolean).pop();
  if (!segment) return "audio";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function checkContentType(contentType: string): void {
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (!base || base === "application/octet-stream" || base === "binary/octet-stream") return;
  if (normaliseMimeType(base) || base.startsWith("audio/")) return;
  if (base === "text/html") {
    throw new ImportError(
      "unsupported",
      "This link opens a web page, not an audio file. Use a direct link to the audio file.",
    );
  }
  throw new ImportError("unsupported", IMPORT_MESSAGES.unsupported);
}

const IDLE_TIMEOUT_MS = 30_000;

export class DirectUrlAudioSource implements AudioSource {
  constructor(
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly pageProtocol: string | undefined = typeof location === "undefined"
      ? undefined
      : location.protocol,
  ) {}

  validate(url: string): string {
    return validateRemoteUrl(url, this.pageProtocol);
  }

  async getAudio(url: string, options: GetAudioOptions = {}): Promise<RemoteAudio> {
    const maxBytes = options.maxBytes ?? MAX_IMPORT_BYTES;
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, IDLE_TIMEOUT_MS);
    };
    const onUserAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onUserAbort, { once: true });
    if (options.signal?.aborted) controller.abort();

    try {
      resetTimer();
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new ImportError(
          "http",
          `${IMPORT_MESSAGES.remote} (The server responded with status ${response.status}.)`,
        );
      }
      if (response.url && isBlockedHost(new URL(response.url).hostname)) {
        throw new ImportError("not-permitted", "This link redirects to YouTube, which isn't supported.");
      }

      const contentType = response.headers.get("content-type") ?? "";
      checkContentType(contentType);
      const length = Number(response.headers.get("content-length") ?? "");
      if (length > maxBytes) throw tooLarge(length, maxBytes);

      const blob = await readBody(response, {
        maxBytes,
        length: Number.isFinite(length) && length > 0 ? length : undefined,
        type: contentType.split(";")[0].trim(),
        onChunk: resetTimer,
        onProgress: options.onProgress,
        abort: () => controller.abort(),
      });
      return { blob, fileName: fileNameFrom(response, url) };
    } catch (error) {
      if (error instanceof ImportError) throw error;
      if (options.signal?.aborted) {
        throw new ImportError("aborted", "Download cancelled.", { cause: error });
      }
      if (timedOut) {
        throw new ImportError("network", "The download stopped responding. Please try again.", {
          cause: error,
        });
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new ImportError("network", "You're offline. Connect to the internet to download audio.", {
          cause: error,
        });
      }
      // fetch() reports CORS refusals and network failures identically.
      throw new ImportError(
        "network",
        `${IMPORT_MESSAGES.remote} If the link opens in your browser, the server may not allow this app to download it (CORS).`,
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onUserAbort);
    }
  }
}

function tooLarge(size: number, maxBytes: number): ImportError {
  return new ImportError(
    "too-large",
    `This file is ${formatBytes(size)}. The limit is ${formatBytes(maxBytes)} per track.`,
  );
}

async function readBody(
  response: Response,
  options: {
    maxBytes: number;
    length?: number;
    type: string;
    onChunk: () => void;
    onProgress?: (fraction: number) => void;
    abort: () => void;
  },
): Promise<Blob> {
  if (!response.body) {
    const blob = await response.blob();
    if (blob.size > options.maxBytes) throw tooLarge(blob.size, options.maxBytes);
    return blob;
  }
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > options.maxBytes) {
      options.abort();
      throw tooLarge(received, options.maxBytes);
    }
    chunks.push(value as Uint8Array<ArrayBuffer>);
    options.onChunk();
    if (options.length) options.onProgress?.(Math.min(1, received / options.length));
  }
  return new Blob(chunks, { type: options.type });
}
