import type { Metadata } from "next";
import { AddMusicScreen } from "@/components/add/add-music-screen";

export const metadata: Metadata = { title: "Add Music" };

export default function AddPage() {
  return <AddMusicScreen />;
}
