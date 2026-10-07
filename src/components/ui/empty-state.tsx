import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-muted" aria-hidden>
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
