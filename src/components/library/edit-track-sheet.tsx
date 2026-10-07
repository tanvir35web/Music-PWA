"use client";

import { useState, type FormEvent } from "react";
import type { Track } from "@/types/track";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { editTrack } from "@/lib/library/actions";
import { runAction } from "@/lib/utils/errors";
import { trackEditSchema, type TrackEditInput } from "@/lib/validation";

interface EditTrackSheetProps {
  track: Track;
  open: boolean;
  onClose: () => void;
}

const FIELDS: Array<{ name: keyof TrackEditInput; label: string; required?: boolean }> = [
  { name: "title", label: "Title", required: true },
  { name: "artist", label: "Artist" },
  { name: "album", label: "Album" },
];

export default function EditTrackSheet({ track, open, onClose }: EditTrackSheetProps) {
  const [values, setValues] = useState<TrackEditInput>({
    title: track.title,
    artist: track.artist ?? "",
    album: track.album ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TrackEditInput, string>>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = trackEditSchema.safeParse(values);
    if (!result.success) {
      const next: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof TrackEditInput;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    const ok = await runAction(() => editTrack(track.id, result.data), { success: "Details saved." });
    if (ok) onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Edit details">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {FIELDS.map((field) => {
          const id = `edit-${field.name}`;
          const error = errors[field.name];
          return (
            <div key={field.name} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-sm font-medium text-muted">
                {field.label}
                {field.required && <span aria-hidden> *</span>}
              </label>
              <input
                id={id}
                value={values[field.name] ?? ""}
                required={field.required}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [field.name]: e.target.value }));
                  setErrors((er) => ({ ...er, [field.name]: undefined }));
                }}
                autoComplete="off"
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-base"
              />
              {error && (
                <p id={`${id}-error`} className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          );
        })}
        <Button type="submit" variant="primary" block>
          Save
        </Button>
      </form>
    </Sheet>
  );
}
