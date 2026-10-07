"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { ThemePreference } from "@/types/settings";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { SwitchRow } from "@/components/ui/switch";
import { useLibrary } from "@/hooks/use-library";
import { usePlaylists } from "@/hooks/use-playlists";
import { useSettings } from "@/hooks/use-settings";
import { clearAllData, clearPlaylists, deleteAllTracks, deleteTracks } from "@/lib/library/actions";
import { checkForUpdate, serviceWorkerStore, type OfflineStatus } from "@/lib/pwa/service-worker";
import { estimateStorage, requestPersistentStorage, type StorageEstimateInfo } from "@/lib/pwa/storage";
import { saveSettings } from "@/lib/settings/settings-store";
import { runAction } from "@/lib/utils/errors";
import { formatBytes } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const LOCK_SCREEN_OPTIONS = [
  { value: "tracks", label: "Previous / Next" },
  { value: "seek", label: "Skip 10 s" },
] as const;

const OFFLINE_TEXT: Record<OfflineStatus, string> = {
  checking: "Checking…",
  ready: "Ready. The app and your library work without a connection.",
  installing: "Preparing for offline use…",
  development: "Disabled in development mode. Use a production build to test offline.",
  insecure: "Unavailable: offline support needs HTTPS (or localhost).",
  unsupported: "This browser doesn't support offline apps.",
  error: "Offline support couldn't be set up. Reload to try again.",
};

type Confirm = "tracks" | "playlists" | "all" | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="mt-6">
      <h2 id={id} className="px-1 pb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="divide-y divide-border rounded-2xl bg-surface px-4">{children}</div>
    </section>
  );
}

function StorageMeter({ usage, quota }: { usage?: number; quota?: number }) {
  if (usage === undefined) return <p className="py-3 text-sm text-muted">Storage usage isn&apos;t available in this browser.</p>;
  const percent = quota ? Math.min(100, (usage / quota) * 100) : 0;
  return (
    <div className="py-3">
      <p className="text-sm text-muted">Storage used</p>
      <p className="text-3xl font-bold tabular-nums">{formatBytes(usage)}</p>
      {quota !== undefined && (
        <>
          <div
            role="meter"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-valuetext={`${formatBytes(usage)} of about ${formatBytes(quota)}`}
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full bg-accent" style={{ width: `${Math.max(percent, 1)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">About {formatBytes(quota)} available to this app (browser estimate)</p>
        </>
      )}
    </div>
  );
}

export function SettingsScreen() {
  const settings = useSettings();
  const { items: tracks } = useLibrary();
  const { items: playlists } = usePlaylists();
  const offline = useSyncExternalStore(serviceWorkerStore.subscribe, serviceWorkerStore.get, serviceWorkerStore.get);
  const [storage, setStorage] = useState<StorageEstimateInfo>({});
  const [confirm, setConfirm] = useState<Confirm>(null);

  const refreshStorage = useCallback(() => {
    void estimateStorage().then(setStorage);
  }, []);
  // Re-estimate whenever the library changes (imports or deletions).
  useEffect(refreshStorage, [refreshStorage, tracks.length]);

  const audioBytes = useMemo(() => tracks.reduce((sum, t) => sum + t.size, 0), [tracks]);
  const largest = useMemo(() => [...tracks].sort((a, b) => b.size - a.size).slice(0, 5), [tracks]);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="px-safe mx-auto max-w-2xl">
        <Section title="Appearance">
          <div className="py-3">
            <Segmented
              label="Theme"
              value={settings.theme}
              options={THEME_OPTIONS}
              onChange={(theme) => saveSettings({ theme })}
            />
          </div>
        </Section>

        <Section title="Playback">
          <SwitchRow
            label="Autoplay next song"
            description="Continue with the next song in the queue when one finishes."
            checked={settings.autoplay}
            onChange={(autoplay) => saveSettings({ autoplay })}
          />
          <div className="py-3">
            <p className="text-[15px]">
              Lock screen buttons
            </p>
            <p className="mb-2 text-sm text-muted">iPhone shows either track or skip buttons, not both.</p>
            <Segmented
              label="Lock screen buttons"
              value={settings.preferTrackButtons ? "tracks" : "seek"}
              options={LOCK_SCREEN_OPTIONS}
              onChange={(value) => saveSettings({ preferTrackButtons: value === "tracks" })}
            />
          </div>
        </Section>

        <Section title="Storage">
          <StorageMeter usage={storage.usage} quota={storage.quota} />
          <dl className="grid grid-cols-2 gap-y-1 py-3 text-sm">
            <dt className="text-muted">Tracks</dt>
            <dd className="text-right tabular-nums">{tracks.length}</dd>
            <dt className="text-muted">Audio files</dt>
            <dd className="text-right tabular-nums">{formatBytes(audioBytes)}</dd>
            <dt className="text-muted">Playlists</dt>
            <dd className="text-right tabular-nums">{playlists.length}</dd>
            <dt className="text-muted">Protected from automatic clearing</dt>
            <dd className="text-right">
              {storage.persisted === undefined ? "Unknown" : storage.persisted ? "Yes" : "No"}
            </dd>
          </dl>
          {storage.persisted === false && (
            <div className="py-3">
              <Button
                variant="secondary"
                block
                onClick={() =>
                  void requestPersistentStorage().then((granted) => {
                    refreshStorage();
                    if (!granted) {
                      toast(
                        "The browser declined. On iPhone, adding the app to your Home Screen and using it regularly helps keep data.",
                      );
                    }
                  })
                }
              >
                Ask to keep my music stored
              </Button>
            </div>
          )}
          {largest.length > 0 && (
            <div className="py-3">
              <h3 className="mb-1 text-sm font-medium text-muted">Largest tracks</h3>
              <ul>
                {largest.map((track) => (
                  <li key={track.id} className="flex min-h-11 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px]">{track.title}</span>
                    <span className="text-sm tabular-nums text-muted">{formatBytes(track.size)}</span>
                    <IconButton
                      label={`Delete ${track.title}`}
                      className="text-danger"
                      onClick={() => void runAction(() => deleteTracks([track.id]), { success: "Track deleted." })}
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="Manage data">
          <div className="flex flex-col gap-2 py-3">
            <Button variant="danger" block disabled={tracks.length === 0} onClick={() => setConfirm("tracks")}>
              Delete all tracks
            </Button>
            <Button variant="danger" block disabled={playlists.length === 0} onClick={() => setConfirm("playlists")}>
              Clear playlists
            </Button>
            <Button variant="danger" block onClick={() => setConfirm("all")}>
              Clear all local data
            </Button>
          </div>
        </Section>

        <Section title="Offline">
          <div className="py-3">
            <p className="text-[15px]">{OFFLINE_TEXT[offline.status]}</p>
            {offline.status === "ready" && (
              <Button variant="ghost" className="-ml-2 mt-1 px-2" onClick={() => void checkForUpdate()}>
                Check for updates
              </Button>
            )}
          </div>
        </Section>

        <p className="mb-6 mt-6 text-center text-xs text-muted">
          Music is stored only on this device. Nothing is uploaded.
        </p>
      </div>

      <ConfirmDialog
        open={confirm === "tracks"}
        title="Delete all tracks?"
        message={`All ${tracks.length} songs and their audio files will be removed from this device. Playlists are kept but emptied.`}
        confirmLabel="Delete All Tracks"
        destructive
        onConfirm={() => runAction(deleteAllTracks, { success: "All tracks deleted." }).then(refreshStorage)}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "playlists"}
        title="Clear all playlists?"
        message="Every playlist will be deleted. Your songs stay in the library."
        confirmLabel="Clear Playlists"
        destructive
        onConfirm={() => runAction(clearPlaylists, { success: "Playlists cleared." }).then(() => undefined)}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "all"}
        title="Clear all local data?"
        message="This permanently deletes every song, playlist and setting stored by this app on this device. This can't be undone."
        confirmLabel="Clear Everything"
        destructive
        onConfirm={() => runAction(clearAllData, { success: "All local data cleared." }).then(refreshStorage)}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
