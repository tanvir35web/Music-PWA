import { createStore } from "./store";

export type ToastTone = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export const toastStore = createStore<ToastItem[]>([]);
let nextId = 1;

export function dismissToast(id: number): void {
  toastStore.set((items) => items.filter((t) => t.id !== id));
}

/** Shows a short message. Errors stay on screen longer than confirmations. */
export function toast(message: string, tone: ToastTone = "info"): void {
  const id = nextId++;
  toastStore.set((items) => [...items.slice(-2), { id, message, tone }]);
  setTimeout(() => dismissToast(id), tone === "error" ? 7000 : 3500);
}
