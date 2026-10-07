"use client";

import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Long-press for touch devices (opens the track menu on iPhone). Returns
 * pointer handlers plus `consumeClick`, which reports whether the click that
 * follows a long-press should be ignored.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") return; // Desktop uses right-click.
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        start.current = null;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const consumeClick = useCallback(() => {
    const wasLongPress = fired.current;
    fired.current = false;
    return wasLongPress;
  }, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel },
    consumeClick,
  };
}
