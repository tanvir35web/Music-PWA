import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaylistDetailScreen } from "@/components/playlist/playlist-detail-screen";

export const metadata: Metadata = { title: "Playlist" };

// Static export cannot prerender per-playlist routes (ids live in
// IndexedDB), so the id is read from the query string on the client.
export default function PlaylistViewPage() {
  return (
    <Suspense>
      <PlaylistDetailScreen />
    </Suspense>
  );
}
