import type { NextConfig } from "next";

// LAN hostnames/IPs allowed to load dev assets, e.g. DEV_ORIGINS=192.168.1.20
// (needed when testing `next dev` from an iPhone on the same network).
const allowedDevOrigins = process.env.DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // The app is fully client-rendered from IndexedDB, so a static export is
  // enough. It gives the service worker a finite, precacheable set of files.
  output: "export",
  // Images are local blobs or static icons; no optimisation server exists.
  images: { unoptimized: true },
  allowedDevOrigins,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
