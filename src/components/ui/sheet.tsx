"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "./button";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (it stays available to screen readers). */
  hideTitle?: boolean;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Bottom sheet on phones, centred dialog on larger screens. Built on the
 * native <dialog> element for focus trapping, Escape handling and the
 * top-layer, without a UI library.
 */
export function Sheet({ open, onClose, title, hideTitle, description, children, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close if the component unmounts while open (e.g. route change).
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        // A click on the dialog itself (not the panel) is a backdrop click.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div
          className={cn(
            "sheet-panel flex max-h-[85dvh] w-full flex-col overflow-hidden bg-surface text-fg shadow-2xl",
            "rounded-t-3xl sm:max-w-md sm:rounded-3xl",
            className,
          )}
        >
          <div className="flex items-center gap-2 px-5 pt-3">
            <div aria-hidden className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-surface-2 sm:hidden" />
            <h2 id={titleId} className={cn("flex-1 pt-3 text-lg font-semibold", hideTitle && "sr-only")}>
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose} className="-mr-2 mt-2 text-muted">
              <X className="size-5" aria-hidden />
            </IconButton>
          </div>
          {description && (
            <p id={descriptionId} className="px-5 text-sm text-muted">
              {description}
            </p>
          )}
          <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,var(--safe-bottom))] pt-3">
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
