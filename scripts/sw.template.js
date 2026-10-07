// Service worker template. `scripts/build-sw.mjs` replaces the two
// placeholders after `next build` and writes the result to out/sw.js.
//
// Strategy:
// - Precache the whole static export (HTML, RSC payloads, JS, CSS, fonts,
//   icons) at install, under a cache named after a hash of the build.
// - Serve same-origin GET requests cache-first; fall back to the network.
// - Never touch cross-origin requests (remote audio downloads) and never
//   cache audio: tracks live in IndexedDB and play from blob: URLs, which
//   don't pass through the service worker at all.
// - A new version waits until the page asks it to take over, so an update
//   never reloads the app in the middle of a song.

const CACHE_VERSION = "__CACHE_VERSION__";
const PRECACHE_URLS = __PRECACHE_MANIFEST__;
const CACHE_NAME = `offline-music-${CACHE_VERSION}`;
const RUNTIME_CACHE = `offline-music-runtime-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // `reload` bypasses the HTTP cache so a stale file is never precached.
      cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("offline-music-") && name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** Maps a navigation URL to the precached HTML file for that route. */
function pageKey(url) {
  let path = url.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/index") return "/";
  if (path.endsWith(".html")) path = path.slice(0, -5);
  return path;
}

async function handleNavigation(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);
  const cached =
    (await cache.match(pageKey(url), { ignoreSearch: true, ignoreVary: true })) ||
    (await cache.match(`${pageKey(url)}.html`, { ignoreSearch: true, ignoreVary: true }));
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    // Offline and the route isn't known: show the app shell.
    return (await cache.match("/")) || Response.error();
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  // Cache hashed build assets fetched after install (e.g. a lazily loaded
  // chunk missing from an older precache). Never cache partial responses.
  const url = new URL(request.url);
  if (response.ok && response.status === 200 && url.pathname.startsWith("/_next/static/")) {
    const copy = response.clone();
    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

/** The Next.js router probes routes with HEAD; answer from the cache when possible. */
async function handleHead(request) {
  const url = new URL(request.url);
  const cached =
    (await caches.match(pageKey(url), { ignoreSearch: true, ignoreVary: true })) ||
    (await caches.match(request, { ignoreSearch: true, ignoreVary: true }));
  if (cached) return new Response(null, { status: cached.status, headers: cached.headers });
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Remote audio, etc.
  if (request.method === "HEAD") {
    event.respondWith(handleHead(request));
    return;
  }
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return; // Media range requests.
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(handleAsset(request));
});
