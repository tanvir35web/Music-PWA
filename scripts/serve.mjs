// Minimal static server for the production export in out/, used to test the
// PWA (service worker, offline mode) on this computer and on an iPhone on the
// same network. Not intended for production hosting.
//
//   npm run serve                    -> http://0.0.0.0:3000
//   HTTPS_CERT=cert.pem HTTPS_KEY=key.pem npm run serve
//                                    -> https://0.0.0.0:3443 (needed on iPhone)
//
// Environment: PORT, HOST, HTTPS_CERT, HTTPS_KEY (paths to PEM files).
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = resolve(fileURLToPath(new URL("../out", import.meta.url)));
const { HTTPS_CERT, HTTPS_KEY } = process.env;
const useHttps = Boolean(HTTPS_CERT && HTTPS_KEY);
const port = Number(process.env.PORT ?? (useHttps ? 3443 : 3000));
const host = process.env.HOST ?? "0.0.0.0";

if (!existsSync(join(outDir, "index.html"))) {
  console.error("serve: out/ is missing. Run `npm run build` first.");
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

// The app only needs its own origin, blob: URLs for local audio/artwork, and
// outbound fetches for user-supplied remote audio links.
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Next.js inlines its RSC bootstrap data.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob: data:",
    "connect-src 'self' https: http:", // Remote audio import; see README.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** Resolves a URL path to a file in out/, supporting clean URLs. */
function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const base = normalize(join(outDir, decoded));
  // Reject path traversal outside out/.
  if (base !== outDir && !base.startsWith(outDir + sep)) return null;
  for (const candidate of [base, `${base}.html`, join(base, "index.html")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function cacheControl(pathname) {
  if (pathname.startsWith("/_next/static/")) return "public, max-age=31536000, immutable";
  // HTML, sw.js and the manifest must always be revalidated to avoid stale versions.
  return "no-cache";
}

function handler(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const file = resolveFile(url.pathname);
  const status = file ? 200 : 404;
  const path = file ?? join(outDir, "404.html");
  res.writeHead(status, {
    "Content-Type": TYPES[extname(path)] ?? "application/octet-stream",
    "Cache-Control": cacheControl(url.pathname),
    ...(url.pathname === "/sw.js" ? { "Service-Worker-Allowed": "/" } : {}),
    ...SECURITY_HEADERS,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(path).pipe(res);
}

const server = useHttps
  ? createHttpsServer({ cert: readFileSync(HTTPS_CERT), key: readFileSync(HTTPS_KEY) }, handler)
  : createHttpServer(handler);

server.listen(port, host, () => {
  const scheme = useHttps ? "https" : "http";
  console.log(`Serving out/ on ${scheme}://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        console.log(`  On your network: ${scheme}://${address.address}:${port}`);
      }
    }
  }
  if (!useHttps) {
    console.log("Note: iPhone needs HTTPS for offline support. See README > Testing on iPhone.");
  }
});
