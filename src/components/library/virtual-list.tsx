"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface VirtualListProps<T> {
  items: readonly T[];
  rowHeight: number;
  getKey: (item: T) => string;
  renderRow: (item: T, index: number) => ReactNode;
  label: string;
  /** Lists at or below this size render every row (better for screen readers). */
  threshold?: number;
  overscan?: number;
}

/**
 * Fixed-height list virtualised against the window scroll, so iOS keeps its
 * native momentum scrolling and tap-status-bar-to-top behaviour.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  getKey,
  renderRow,
  label,
  threshold = 120,
  overscan = 10,
}: VirtualListProps<T>) {
  const ref = useRef<HTMLUListElement>(null);
  const virtual = items.length > threshold;
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length, 40) });

  useEffect(() => {
    if (!virtual) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const list = ref.current;
      if (!list) return;
      const top = list.getBoundingClientRect().top;
      const start = Math.max(0, Math.floor(-top / rowHeight) - overscan);
      const end = Math.min(items.length, Math.ceil((window.innerHeight - top) / rowHeight) + overscan);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [virtual, items.length, rowHeight, overscan]);

  if (!virtual) {
    return (
      <ul aria-label={label}>
        {items.map((item, index) => (
          <li key={getKey(item)} style={{ height: rowHeight }}>
            {renderRow(item, index)}
          </li>
        ))}
      </ul>
    );
  }

  const end = Math.min(range.end, items.length);
  const rows: ReactNode[] = [];
  for (let index = range.start; index < end; index++) {
    const item = items[index];
    rows.push(
      <li
        key={getKey(item)}
        aria-setsize={items.length}
        aria-posinset={index + 1}
        style={{ position: "absolute", top: index * rowHeight, left: 0, right: 0, height: rowHeight }}
      >
        {renderRow(item, index)}
      </li>,
    );
  }
  return (
    <ul ref={ref} aria-label={label} style={{ position: "relative", height: items.length * rowHeight }}>
      {rows}
    </ul>
  );
}
