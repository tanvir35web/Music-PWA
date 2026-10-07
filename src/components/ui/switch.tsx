"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A settings row with an iOS-style switch (a native checkbox with role="switch"). */
export function SwitchRow({ label, description, checked, onChange }: SwitchRowProps) {
  const id = useId();
  const descriptionId = useId();
  return (
    <div className="flex min-h-14 items-center gap-4 py-2">
      <div className="flex-1">
        <label htmlFor={id} className="text-[15px]">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-sm text-muted">
            {description}
          </p>
        )}
      </div>
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          aria-describedby={description ? descriptionId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className={cn(
            "h-[31px] w-[51px] rounded-full transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
            checked ? "bg-success" : "bg-surface-2",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 size-[27px] rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
    </div>
  );
}
