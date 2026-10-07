import { z } from "zod";
import type { AppSettings } from "@/types/settings";
import { STORES, transact } from "./indexed-db";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  autoplay: true,
  repeatMode: "off",
  shuffle: false,
  volume: 1,
  playbackRate: 1,
  lastTrackId: null,
  lastPosition: 0,
  lastQueue: [],
  preferTrackButtons: true,
};

const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  autoplay: z.boolean(),
  repeatMode: z.enum(["off", "one", "all"]),
  shuffle: z.boolean(),
  volume: z.number().min(0).max(1),
  playbackRate: z.number().min(0.25).max(4),
  lastTrackId: z.string().nullable(),
  lastPosition: z.number().min(0),
  lastQueue: z.array(z.string()),
  preferTrackButtons: z.boolean(),
}) satisfies z.ZodType<AppSettings>;

type SettingsKey = keyof AppSettings;

interface SettingRecord {
  key: string;
  value: unknown;
}

function isSettingsKey(key: string): key is SettingsKey {
  return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key);
}

/** Reads stored settings. Unknown or invalid values fall back to defaults. */
export async function getSettings(): Promise<AppSettings> {
  const records = await transact(STORES.settings, "readonly", (tx) => {
    const request = tx.objectStore(STORES.settings).getAll();
    return () => request.result as SettingRecord[];
  });

  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const { key, value } of records) {
    if (!isSettingsKey(key)) continue;
    const parsed = settingsSchema.shape[key].safeParse(value);
    if (parsed.success) settings[key] = parsed.data;
  }
  return settingsSchema.parse(settings);
}

export function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const entries = Object.entries(patch).filter(
    ([key, value]) =>
      isSettingsKey(key) && settingsSchema.shape[key].safeParse(value).success,
  );
  if (entries.length === 0) return Promise.resolve();
  return transact(STORES.settings, "readwrite", (tx) => {
    const store = tx.objectStore(STORES.settings);
    for (const [key, value] of entries) store.put({ key, value });
    return () => undefined;
  });
}
