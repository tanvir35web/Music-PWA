import { toast } from "./toast";

/** Extracts a user-facing message from an unknown error. */
export function messageOf(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Runs a UI action, reporting failures as a toast instead of letting them
 * crash the app. Returns true when the action succeeded.
 */
export async function runAction(
  action: () => Promise<unknown>,
  messages: { success?: string; failure?: string } = {},
): Promise<boolean> {
  try {
    await action();
    if (messages.success) toast(messages.success, "success");
    return true;
  } catch (error) {
    console.error(error);
    toast(messages.failure ?? messageOf(error), "error");
    return false;
  }
}
