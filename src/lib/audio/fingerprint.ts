/** Files up to this size are hashed in full. */
export const FULL_HASH_LIMIT = 32 * 1024 * 1024;
const SAMPLE_BYTES = 2 * 1024 * 1024;

export function fileFingerprint(file: { name: string; size: number; lastModified: number }): string {
  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

/** Normalises a URL so trivially different spellings match. */
export function urlFingerprint(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return `url:${parsed.href}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 content hash used for duplicate detection.
 *
 * Small files are hashed in full. Larger files are hashed from their size
 * plus three 2 MB samples (start, middle, end) so that a 200 MB file does not
 * have to be read into memory at once. The prefix records which scheme was
 * used so both kinds never collide.
 *
 * Returns undefined when Web Crypto is unavailable (insecure HTTP origins).
 */
export async function computeContentHash(blob: Blob): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;

  if (blob.size <= FULL_HASH_LIMIT) {
    return `sha256:${toHex(await subtle.digest("SHA-256", await blob.arrayBuffer()))}`;
  }

  const middle = Math.floor(blob.size / 2 - SAMPLE_BYTES / 2);
  const size = new Uint8Array(8);
  new DataView(size.buffer).setFloat64(0, blob.size);
  const sampled = new Blob([
    size,
    blob.slice(0, SAMPLE_BYTES),
    blob.slice(middle, middle + SAMPLE_BYTES),
    blob.slice(blob.size - SAMPLE_BYTES),
  ]);
  return `sha256s:${toHex(await subtle.digest("SHA-256", await sampled.arrayBuffer()))}`;
}
