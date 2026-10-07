// Runs after `next build` (npm "postbuild"). Lists every file in the static
// export, derives a content hash for the cache version, and writes out/sw.js
// from scripts/sw.template.js.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "out");
const template = join(root, "scripts", "sw.template.js");

if (!existsSync(outDir)) {
  console.error("build-sw: out/ not found. Run `next build` with output: 'export' first.");
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * Next.js names segment-prefetch files `__next.<segments joined by ".">.txt`,
 * but on Windows its exporter joins the segments with "\" and so writes
 * `settings/__next.settings/__PAGE__.txt` instead of
 * `settings/__next.settings.__PAGE__.txt`. The client requests the dotted
 * name, so flatten any such nesting. This is a no-op on Linux/macOS builds.
 */
function flattenSegmentFiles() {
  let moved = 0;
  for (const path of walk(outDir)) {
    const parts = relative(outDir, path).split(sep);
    const index = parts.findIndex((part, i) => i < parts.length - 1 && part.startsWith("__next."));
    if (index === -1) continue;
    const target = join(outDir, ...parts.slice(0, index), parts.slice(index).join("."));
    renameSync(path, target);
    moved++;
  }
  // Remove the now-empty __next.* directory trees.
  for (const dir of listDirs(outDir)) {
    if (existsSync(dir) && dir.split(sep).pop().startsWith("__next.") && walk(dir).length === 0) {
      rmSync(dir, { recursive: true });
    }
  }
  if (moved > 0) console.log(`build-sw: flattened ${moved} segment prefetch files (Windows export fix)`);
}

function listDirs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? [...listDirs(path), path] : [];
  });
}

flattenSegmentFiles();

/** Files that must not be precached. */
function excluded(rel) {
  return (
    rel === "sw.js" ||
    rel.endsWith(".map") ||
    rel === "404.html" ||
    rel.startsWith("404/") ||
    rel.includes("_not-found") ||
    rel.split("/").some((part) => part.startsWith("."))
  );
}

/** Pages are cached under their clean URL (`/library`, not `/library.html`). */
function toUrl(rel) {
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"/index.html".length)}`;
  if (rel.endsWith(".html")) return `/${rel.slice(0, -".html".length)}`;
  return `/${rel}`;
}

const files = walk(outDir)
  .map((path) => ({ path, rel: relative(outDir, path).split(sep).join("/") }))
  .filter(({ rel }) => !excluded(rel))
  .sort((a, b) => a.rel.localeCompare(b.rel));

const hash = createHash("sha256");
for (const { path, rel } of files) {
  hash.update(rel);
  hash.update(readFileSync(path));
}
const version = hash.digest("hex").slice(0, 12);
const urls = [...new Set(files.map(({ rel }) => encodeURI(toUrl(rel))))];

const source = readFileSync(template, "utf8")
  .replace("__CACHE_VERSION__", version)
  .replace("__PRECACHE_MANIFEST__", JSON.stringify(urls, null, 2));
writeFileSync(join(outDir, "sw.js"), source);

const bytes = files.reduce((sum, { path }) => sum + statSync(path).size, 0);
console.log(
  `build-sw: wrote out/sw.js (version ${version}, ${urls.length} files, ${(bytes / 1024).toFixed(0)} KB precached)`,
);
