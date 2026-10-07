"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, CircleMinus, FileAudio, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportQueue, type ImportItem } from "@/hooks/use-import-queue";
import { AUDIO_ACCEPT, MAX_IMPORT_BYTES } from "@/lib/audio/audio-formats";
import type { ImportStage } from "@/lib/audio/import-service";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "@/lib/utils/format";

const STAGE_LABEL: Record<ImportStage, string> = {
  downloading: "Downloading",
  validating: "Checking file",
  "checking-duplicates": "Checking for duplicates",
  "reading-metadata": "Reading song details",
  saving: "Saving to device",
  done: "Done",
};

function StatusIcon({ status }: { status: ImportItem["status"] }) {
  switch (status) {
    case "done":
      return <CircleCheck aria-hidden className="size-5 text-success" />;
    case "failed":
      return <CircleAlert aria-hidden className="size-5 text-danger" />;
    case "skipped":
      return <CircleMinus aria-hidden className="size-5 text-muted" />;
    case "importing":
      return <LoaderCircle aria-hidden className="size-5 animate-spin text-accent" />;
    default:
      return <FileAudio aria-hidden className="size-5 text-muted" />;
  }
}

function ImportRow({ item }: { item: ImportItem }) {
  const detail =
    item.status === "importing"
      ? (STAGE_LABEL[item.stage ?? "validating"] ?? "Importing")
      : item.status === "queued"
        ? "Waiting"
        : item.message;
  return (
    <li className="flex items-start gap-3 py-3">
      <StatusIcon status={item.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{item.name}</p>
        <p
          className={cn(
            "text-sm",
            item.status === "failed" ? "text-danger" : "text-muted",
          )}
        >
          {formatBytes(item.size)} · {detail}
        </p>
        {item.status === "importing" && (
          <progress
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface-2 [&::-webkit-progress-value]:bg-accent"
            value={item.fraction}
            max={1}
            aria-label={`Importing ${item.name}`}
          />
        )}
      </div>
    </li>
  );
}

export function FileImport() {
  const { items, addFiles, clearFinished } = useImportQueue();
  const [dragging, setDragging] = useState(false);
  const active = items.filter((i) => i.status === "queued" || i.status === "importing").length;

  return (
    <section
      aria-labelledby="files-heading"
      className="rounded-2xl border border-border bg-surface p-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <h2 id="files-heading" className="text-lg font-semibold">
        From this device
      </h2>
      <p className="mt-1 text-sm text-muted">
        Choose songs from Files, iCloud Drive or other storage. MP3, M4A, AAC, WAV, OGG, WebM and FLAC
        up to {formatBytes(MAX_IMPORT_BYTES)} each. Files stay on this device.
      </p>

      <label
        className={cn(
          "mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition",
          "focus-within:outline focus-within:outline-2 focus-within:outline-accent",
          dragging ? "border-accent bg-accent/10" : "border-border",
        )}
      >
        <Upload aria-hidden className="size-7 text-accent" />
        <span className="font-semibold text-accent">Choose audio files</span>
        <span className="hidden text-xs text-muted sm:block">or drop them here</span>
        <input
          type="file"
          accept={AUDIO_ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ""; // Allow choosing the same file again.
          }}
        />
      </label>

      {items.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p role="status" className="text-sm text-muted">
              {active > 0 ? `Importing ${active} file${active === 1 ? "" : "s"}…` : "Import finished."}
            </p>
            {active === 0 && (
              <Button variant="ghost" className="min-h-9 px-2 text-sm" onClick={clearFinished}>
                Clear
              </Button>
            )}
          </div>
          <ul aria-label="Import progress" className="divide-y divide-border">
            {items.map((item) => (
              <ImportRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
