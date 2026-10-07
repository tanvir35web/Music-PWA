"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { runAction } from "@/lib/utils/errors";
import { firstIssue, PLAYLIST_NAME_MAX, playlistNameSchema } from "@/lib/validation";

interface PlaylistNameSheetProps {
  open: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  onSubmit: (name: string) => Promise<unknown>;
  onClose: () => void;
}

const SUGGESTIONS = ["Focus", "Sleep", "Workout", "Road Trip"];

export function PlaylistNameSheet({
  open,
  title,
  submitLabel,
  initialName = "",
  onSubmit,
  onClose,
}: PlaylistNameSheetProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue = firstIssue(playlistNameSchema.safeParse(name));
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    const ok = await runAction(() => onSubmit(name));
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <label htmlFor="playlist-name" className="text-sm font-medium text-muted">
          Name
        </label>
        <input
          id="playlist-name"
          value={name}
          maxLength={PLAYLIST_NAME_MAX}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "playlist-name-error" : undefined}
          className="min-h-11 rounded-xl border border-border bg-bg px-3 text-base"
        />
        {error && (
          <p id="playlist-name-error" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!initialName && (
          <div className="flex flex-wrap gap-2" aria-label="Suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setName(suggestion);
                  setError(null);
                }}
                className="min-h-9 rounded-full bg-surface-2 px-3 text-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <Button type="submit" variant="primary" block disabled={busy}>
          {submitLabel}
        </Button>
      </form>
    </Sheet>
  );
}
