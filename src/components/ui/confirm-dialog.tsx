"use client";

import { useState } from "react";
import { Button } from "./button";
import { Sheet } from "./sheet";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} description={message}>
      <div className="flex flex-col gap-2 pt-2">
        <Button variant={destructive ? "danger" : "primary"} block onClick={confirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </Button>
        <Button variant="secondary" block onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
