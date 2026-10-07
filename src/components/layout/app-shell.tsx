"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MiniPlayer } from "@/components/player/mini-player";
import { TrackMenuHost } from "@/components/library/track-menu";
import { UpdateBanner } from "@/components/pwa/update-banner";
import { Toaster } from "@/components/ui/toast";
import { useCurrentTrack } from "@/hooks/use-player";
import { startApp } from "@/lib/app/bootstrap";
import { BottomNav } from "./bottom-nav";

/**
 * Persistent chrome around every route. Because it lives in the root layout,
 * the mini player and audio keep running across navigation.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hasTrack = useCurrentTrack() !== undefined;
  const immersive = pathname.startsWith("/player");

  useEffect(() => {
    startApp();
  }, []);

  const bottomPadding = immersive
    ? undefined
    : `calc(var(--nav-height) + var(--safe-bottom) + ${hasTrack ? "var(--mini-height) + 1.5rem" : "1rem"})`;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <UpdateBanner />
      <main id="main" style={{ paddingBottom: bottomPadding }}>
        {children}
      </main>
      {!immersive && (
        <>
          <MiniPlayer />
          <BottomNav />
        </>
      )}
      <TrackMenuHost />
      <Toaster />
    </>
  );
}
