"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, ListMusic, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/", label: "Library", icon: Library, match: (p: string) => p === "/" || p.startsWith("/library") },
  { href: "/playlists", label: "Playlists", icon: ListMusic, match: (p: string) => p.startsWith("/playlists") },
  { href: "/add", label: "Add Music", icon: Plus, match: (p: string) => p.startsWith("/add") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-chrome pb-safe backdrop-blur-xl"
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-2xl px-[var(--safe-left)]">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon aria-hidden className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
