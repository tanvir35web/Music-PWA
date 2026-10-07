import type { Metadata } from "next";
import { FullPlayer } from "@/components/player/full-player";

export const metadata: Metadata = { title: "Now Playing" };

export default function PlayerPage() {
  return <FullPlayer />;
}
