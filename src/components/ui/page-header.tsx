import type { ReactNode } from "react";
import { OnlineIndicator } from "@/components/pwa/online-indicator";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Shown above the title, e.g. a back button. */
  leading?: ReactNode;
}

/** iOS-style large title header that respects the status bar safe area. */
export function PageHeader({ title, subtitle, actions, leading }: PageHeaderProps) {
  return (
    <header className="px-safe pt-[calc(var(--safe-top)+0.75rem)]">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <div className="-ml-2">{leading}</div>
        <div className="flex items-center gap-1">
          <OnlineIndicator />
          {actions}
        </div>
      </div>
      <h1 className="mt-1 truncate text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </header>
  );
}
