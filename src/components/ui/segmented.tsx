"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}

/** iOS-style segmented control, implemented as a native radio group. */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className={cn("flex rounded-xl bg-surface-2 p-1", className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "relative flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-medium transition",
            "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
            value === option.value ? "bg-surface text-fg shadow-sm" : "text-muted",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
