"use client";

import { useCallback, useRef, useState } from "react";
import type { ImportStage } from "@/lib/audio/import-service";
import { importAudioFile } from "@/lib/audio/import-service";
import { ImportError } from "@/lib/audio/import-errors";
import { canBrowserPlay } from "@/lib/audio/audio-formats";
import { probeDuration } from "@/lib/audio/probe-duration";
import { addImportedTrack } from "@/lib/library/actions";
import { createId } from "@/lib/utils/id";
import { messageOf } from "@/lib/utils/errors";

export type ImportItemStatus = "queued" | "importing" | "done" | "skipped" | "failed";

export interface ImportItem {
  id: string;
  name: string;
  size: number;
  status: ImportItemStatus;
  stage?: ImportStage;
  fraction: number;
  message?: string;
}

/**
 * Imports files one at a time. Sequential processing keeps memory use low
 * on iPhone, where several large files hashed in parallel could be killed.
 */
export function useImportQueue() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const files = useRef(new Map<string, File>());
  const pending = useRef<string[]>([]);
  const running = useRef(false);

  const patch = useCallback((id: string, update: Partial<ImportItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, []);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (let id = pending.current.shift(); id; id = pending.current.shift()) {
        const file = files.current.get(id);
        if (!file) continue;
        patch(id, { status: "importing", fraction: 0 });
        try {
          const track = await importAudioFile(file, {
            probeDuration,
            onProgress: ({ stage, fraction }) => patch(id, { stage, fraction }),
          });
          addImportedTrack(track);
          patch(id, {
            status: "done",
            fraction: 1,
            message: canBrowserPlay(track.mimeType)
              ? `Added "${track.title}".`
              : `Added "${track.title}", but this browser may not be able to play this format.`,
          });
        } catch (error) {
          const duplicate = error instanceof ImportError && error.code === "duplicate";
          patch(id, {
            status: duplicate ? "skipped" : "failed",
            message: messageOf(error, "Unable to import this file."),
          });
        } finally {
          files.current.delete(id);
        }
      }
    } finally {
      running.current = false;
    }
  }, [patch]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const added: ImportItem[] = Array.from(list).map((file) => {
        const id = createId();
        files.current.set(id, file);
        pending.current.push(id);
        return { id, name: file.name, size: file.size, status: "queued", fraction: 0 };
      });
      if (added.length === 0) return;
      setItems((current) => [...added, ...current]);
      void run();
    },
    [run],
  );

  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((i) => i.status === "queued" || i.status === "importing"));
  }, []);

  return { items, addFiles, clearFinished };
}
