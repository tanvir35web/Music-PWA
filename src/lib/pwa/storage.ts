export interface StorageEstimateInfo {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}

/** Storage usage for this origin. Fields are undefined where unsupported. */
export async function estimateStorage(): Promise<StorageEstimateInfo> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  const [estimate, persisted] = await Promise.all([
    storage?.estimate?.().catch(() => undefined),
    storage?.persisted?.().catch(() => undefined),
  ]);
  return { usage: estimate?.usage, quota: estimate?.quota, persisted };
}

/**
 * Asks the browser not to evict this app's data under storage pressure.
 * Browsers may grant or refuse silently; the result is advisory.
 */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage?.persist) return undefined;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return undefined;
  }
}
