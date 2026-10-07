import type { AppSettings } from "@/types/settings";
import { createStore } from "@/lib/utils/store";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "@/lib/db/settings-repository";

export const settingsStore = createStore<AppSettings & { loaded: boolean }>({
  ...DEFAULT_SETTINGS,
  loaded: false,
});

export async function loadSettings(): Promise<AppSettings> {
  try {
    const settings = await getSettings();
    settingsStore.set({ ...settings, loaded: true });
    return settings;
  } catch (error) {
    console.error("Settings couldn't be loaded; using defaults.", error);
    settingsStore.set({ ...DEFAULT_SETTINGS, loaded: true });
    return DEFAULT_SETTINGS;
  }
}

/** Updates settings in memory immediately and persists them in the background. */
export function saveSettings(patch: Partial<AppSettings>): void {
  settingsStore.set((current) => ({ ...current, ...patch }));
  updateSettings(patch).catch((error: unknown) => {
    console.error("Settings couldn't be saved.", error);
  });
}

export function resetSettingsStore(): void {
  settingsStore.set({ ...DEFAULT_SETTINGS, loaded: true });
}
