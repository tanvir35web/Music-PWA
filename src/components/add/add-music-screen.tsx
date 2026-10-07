"use client";

import { PageHeader } from "@/components/ui/page-header";
import { FileImport } from "./file-import";
import { UrlImport } from "./url-import";

export function AddMusicScreen() {
  return (
    <>
      <PageHeader title="Add Music" subtitle="Import songs to play them offline." />
      <div className="px-safe mx-auto mt-4 flex max-w-2xl flex-col gap-4">
        <FileImport />
        <UrlImport />
      </div>
    </>
  );
}
