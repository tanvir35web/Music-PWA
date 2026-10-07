export const DB_NAME = "offline-music-db";
export const DB_VERSION = 1;

export const STORES = {
  tracks: "tracks",
  audioFiles: "audioFiles",
  playlists: "playlists",
  settings: "settings",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export type StorageErrorKind = "quota" | "unavailable" | "unknown";

export class StorageError extends Error {
  readonly kind: StorageErrorKind;

  constructor(kind: StorageErrorKind, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "StorageError";
    this.kind = kind;
  }
}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const name = error instanceof DOMException ? error.name : "";
  if (name === "QuotaExceededError") {
    return new StorageError(
      "quota",
      "Your device may not have enough available storage.",
      error,
    );
  }
  if (name === "InvalidStateError" || name === "UnknownError") {
    return new StorageError(
      "unavailable",
      "Local storage is temporarily unavailable. Please try again.",
      error,
    );
  }
  return new StorageError("unknown", "A local storage error occurred.", error);
}

function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    const tracks = db.createObjectStore(STORES.tracks, { keyPath: "id" });
    tracks.createIndex("createdAt", "createdAt");
    tracks.createIndex("fingerprint", "fingerprint");
    tracks.createIndex("contentHash", "contentHash");
    db.createObjectStore(STORES.audioFiles, { keyPath: "trackId" });
    db.createObjectStore(STORES.playlists, { keyPath: "id" });
    db.createObjectStore(STORES.settings, { keyPath: "key" });
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new StorageError(
        "unavailable",
        "This browser does not support offline storage (IndexedDB).",
      ),
    );
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgraded the schema: release our connection.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(toStorageError(request.error));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(
        new StorageError(
          "unavailable",
          "Close other open copies of this app and try again.",
        ),
      );
    };
  });
  return dbPromise;
}

/** Closes the cached connection. Used by tests and before deleting data. */
export async function closeDatabase(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    // Opening had failed; nothing to close.
  }
}

/**
 * Runs `work` inside one transaction. `work` must issue its requests
 * synchronously (or from request callbacks) and return a getter that is
 * evaluated once the transaction has committed. Awaiting other promises
 * inside `work` would let the transaction auto-commit early.
 */
export async function transact<T>(
  storeNames: StoreName | StoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => () => T,
): Promise<T> {
  try {
    return await runTransaction(storeNames, mode, work);
  } catch (error) {
    // Safari can drop the IndexedDB connection while the app is in the
    // background. A failed transaction commits nothing, so retry once.
    if (toStorageError(error).kind !== "unavailable") throw normalise(error);
    await closeDatabase();
    try {
      return await runTransaction(storeNames, mode, work);
    } catch (retryError) {
      throw normalise(retryError);
    }
  }
}

/** Converts browser storage exceptions; leaves application errors intact. */
function normalise(error: unknown): unknown {
  return error instanceof DOMException ? toStorageError(error) : error;
}

async function runTransaction<T>(
  storeNames: StoreName | StoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => () => T,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let getResult: () => T;
    try {
      getResult = work(tx);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // Already finished.
      }
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(getResult());
    tx.onerror = (event) => {
      // Keep the error from also surfacing as an unhandled window error.
      event.preventDefault();
      reject(tx.error ?? (event.target as IDBRequest | null)?.error);
    };
    tx.onabort = () =>
      reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

/** Clears every store in a single transaction. */
export function clearAllStores(): Promise<void> {
  const names = Object.values(STORES);
  return transact(names, "readwrite", (tx) => {
    for (const name of names) tx.objectStore(name).clear();
    return () => undefined;
  });
}
