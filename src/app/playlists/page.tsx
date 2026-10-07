import type { Metadata } from "next";
import { PlaylistsScreen } from "@/components/playlist/playlists-screen";

export const metadata: Metadata = { title: "Playlists" };

export default function PlaylistsPage() {
  return <PlaylistsScreen />;
}
