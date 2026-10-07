export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  /** Seconds. Undefined until the browser could read it. */
  duration?: number;
  mimeType: string;
  /** Bytes. */
  size: number;
  coverArt?: Blob;
  isFavorite: boolean;
  playCount: number;
  lastPlayedAt?: number;
  createdAt: number;
  updatedAt: number;
  /** Where the audio came from, for display and duplicate detection. */
  source: TrackSource;
  /** Cheap duplicate key: name + size + lastModified (files) or URL (remote). */
  fingerprint: string;
  /** SHA-256 of the content (or of sampled chunks for very large files). */
  contentHash?: string;
}

export type TrackSource =
  | { kind: "file"; fileName: string; lastModified: number }
  | { kind: "url"; url: string };

export interface AudioFile {
  trackId: string;
  blob: Blob;
}

export type TrackSort = "title" | "artist" | "recent";
