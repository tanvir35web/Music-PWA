"use client";

import { useRef, useState, type FormEvent } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { importRemoteAudio } from "@/lib/audio/import-service";
import { probeDuration } from "@/lib/audio/probe-duration";
import { addImportedTrack } from "@/lib/library/actions";
import { messageOf } from "@/lib/utils/errors";
import { toast } from "@/lib/utils/toast";
import { remoteImportSchema } from "@/lib/validation";

type FieldErrors = Partial<Record<"url" | "authorised", string>>;

export function UrlImport() {
  const online = useOnlineStatus();
  const [url, setUrl] = useState("");
  const [authorised, setAuthorised] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = progress !== null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const parsed = remoteImportSchema.safeParse({ url, authorised });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    controller.current = new AbortController();
    setProgress(0);
    try {
      const track = await importRemoteAudio(parsed.data.url, {
        signal: controller.current.signal,
        probeDuration,
        onProgress: ({ fraction }) => setProgress(fraction),
      });
      addImportedTrack(track);
      toast(`Added "${track.title}" to your library.`, "success");
      setUrl("");
      setAuthorised(false);
    } catch (error) {
      setFailure(messageOf(error));
    } finally {
      setProgress(null);
      controller.current = null;
    }
  }

  return (
    <section aria-labelledby="url-heading" className="rounded-2xl border border-border bg-surface p-4">
      <h2 id="url-heading" className="text-lg font-semibold">
        From a link
      </h2>
      <p className="mt-1 text-sm text-muted">
        Paste a direct link to an audio file (for example, a file you host or one licensed for
        download). Web pages, YouTube and streaming services aren&apos;t supported. The server must
        allow downloads from other sites (CORS).
      </p>

      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audio-url" className="text-sm font-medium text-muted">
            Audio file URL
          </label>
          <div className="relative">
            <Link2 aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="audio-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="https://example.com/audio/song.mp3"
              value={url}
              disabled={busy}
              onChange={(e) => {
                setUrl(e.target.value);
                setErrors((er) => ({ ...er, url: undefined }));
              }}
              aria-invalid={errors.url ? true : undefined}
              aria-describedby={errors.url ? "audio-url-error" : undefined}
              className="min-h-11 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-base"
            />
          </div>
          {errors.url && (
            <p id="audio-url-error" className="text-sm text-danger">
              {errors.url}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={authorised}
              disabled={busy}
              onChange={(e) => {
                setAuthorised(e.target.checked);
                setErrors((er) => ({ ...er, authorised: undefined }));
              }}
              aria-invalid={errors.authorised ? true : undefined}
              aria-describedby={errors.authorised ? "authorised-error" : undefined}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent-solid)]"
            />
            I own this audio or have permission to download and keep a copy of it.
          </label>
          {errors.authorised && (
            <p id="authorised-error" className="mt-1 text-sm text-danger">
              {errors.authorised}
            </p>
          )}
        </div>

        {busy ? (
          <div className="flex flex-col gap-2">
            <progress
              className="h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface-2 [&::-webkit-progress-value]:bg-accent"
              value={progress ?? undefined}
              max={1}
              aria-label="Download progress"
            />
            <Button variant="secondary" block onClick={() => controller.current?.abort()}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="submit" variant="primary" block disabled={!online}>
            {online ? "Download and add" : "Connect to the internet to download"}
          </Button>
        )}

        {failure && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {failure}
          </p>
        )}
      </form>
    </section>
  );
}
