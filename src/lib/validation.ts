import { z } from "zod";

export const PLAYLIST_NAME_MAX = 60;

export const playlistNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a playlist name.")
  .max(PLAYLIST_NAME_MAX, `Use ${PLAYLIST_NAME_MAX} characters or fewer.`);

/** Returns the first validation message, or null when valid. */
export function firstIssue(result: z.ZodSafeParseResult<unknown>): string | null {
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid value.");
}

/** Validates a playlist name, throwing an Error with a user-facing message. */
export function parsePlaylistName(name: string): string {
  const result = playlistNameSchema.safeParse(name);
  if (!result.success) throw new Error(firstIssue(result) ?? "Invalid name.");
  return result.data;
}

const optionalText = z
  .string()
  .trim()
  .max(200, "Use 200 characters or fewer.")
  .transform((value) => value || undefined);

export const trackEditSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Use 200 characters or fewer."),
  artist: optionalText,
  album: optionalText,
});

export type TrackEditInput = z.input<typeof trackEditSchema>;

/** Remote import form: a URL plus explicit confirmation of the right to use it. */
export const remoteImportSchema = z.object({
  url: z.string().trim().min(1, "Paste a link to an audio file."),
  authorised: z.literal(true, { error: "Confirm you have permission to download this audio." }),
});
