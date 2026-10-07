import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Offline Music", template: "%s · Offline Music" },
  description: "Your music library, stored on your device and playable offline.",
  applicationName: "Offline Music",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Music",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // Next emits only `mobile-web-app-capable`; older iOS versions need the Apple name.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch/home indicator; safe-area insets pad the content.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        {/* Must run before first paint to apply a saved light/dark override without a
            flash. It is a few bytes, same-origin and precached by the service worker. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
