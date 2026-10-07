import { describe, expect, it, vi } from "vitest";
import { getOnlineStatus, subscribeOnlineStatus } from "./online-status";

describe("online status", () => {
  it("reads navigator.onLine", () => {
    expect(getOnlineStatus({ onLine: true })).toBe(true);
    expect(getOnlineStatus({ onLine: false })).toBe(false);
  });

  it("notifies on offline and online events until unsubscribed", () => {
    const target = new EventTarget();
    const callback = vi.fn();
    const unsubscribe = subscribeOnlineStatus(callback, target as unknown as Window);

    target.dispatchEvent(new Event("offline"));
    target.dispatchEvent(new Event("online"));
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    target.dispatchEvent(new Event("offline"));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("follows a mocked navigator going offline and back online", () => {
    const nav = { onLine: true };
    const target = new EventTarget();
    const seen: boolean[] = [];
    subscribeOnlineStatus(() => seen.push(getOnlineStatus(nav)), target as unknown as Window);

    nav.onLine = false;
    target.dispatchEvent(new Event("offline"));
    nav.onLine = true;
    target.dispatchEvent(new Event("online"));
    expect(seen).toEqual([false, true]);
  });
});
