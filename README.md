# Offline Music

An offline-first music player PWA aimed at iPhone (Safari + Add to Home Screen). You import audio you own or have permission to use. It is stored on the device in IndexedDB and plays without a network connection. There is no backend, and audio is never uploaded.

## Status and assumptions

- **Verified:** unit tests (Vitest, Node), lint, typecheck, production build, and an automated end-to-end run in desktop Chrome with an emulated iPhone viewport. The run covers import, duplicate detection, playback, navigation while playing, playlists, offline reload and playback, theme persistence, deletion, a 800-track library, and the service-worker update flow.
- **Not yet verified:** a real iPhone, Safari or WebKit. Everything under [iOS behaviour](#ios-behaviour-and-limitations) still needs a check on a device.
- Remote import works only with direct audio-file URLs whose server allows cross-origin requests (CORS). YouTube links are refused. There is no extraction of streams from video or music services.

## Stack

Next.js 16 (App Router, `output: "export"`), React 19, TypeScript (strict), Tailwind CSS 4, Zod, lucide-react. Tests use Vitest and fake-indexeddb.

Not used, on purpose:
- **shadcn/ui and Radix.** The native `<dialog>` covers sheets and confirmations, including focus trapping and Escape handling.
- **React Hook Form.** Every form has one to three fields and is validated with Zod.
- **`idb` and `music-metadata`.** A small IndexedDB wrapper and ID3/MP4 tag readers are included instead.
- **PWA plugins.** The service worker is hand-written (about 120 lines) so its caching behaviour is explicit.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on http://localhost:3000. The service worker is disabled. |
| `npm run build` | Static export to `out/`, then generates `out/sw.js` (`scripts/build-sw.mjs`). |
| `npm run serve` | Serves `out/` on port 3000 (or 3443 with HTTPS) for PWA and offline testing. |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint / `tsc --noEmit` / Vitest. |
| `npm run icons` | Regenerates the PNG icons in `public/icons/`. |

## Architecture

```text
src/
  app/                      Routes: / (library), /library, /playlists, /playlists/view?id=, /player, /add, /settings
  components/
    layout/                 AppShell (persistent mini player, tab bar, track menu, toasts)
    library/ player/ playlist/ add/ settings/ pwa/ ui/
  hooks/                    use-player, use-library, use-playlists, use-online-status, use-settings, ...
  lib/
    db/                     indexed-db.ts (wrapper), tracks-, playlists-, settings-repository.ts
    audio/                  audio-engine.ts, media-session.ts, import-service.ts, remote-source.ts, metadata.ts, ...
    library/                in-memory stores, use-case actions, search and sort
    app/bootstrap.ts        loads data, restores the session, persists playback state
    pwa/                    service worker registration, online status, storage estimate
  types/                    track, playlist, player, settings
scripts/                    sw.template.js, build-sw.mjs, serve.mjs, generate-icons.mjs
```

Key decisions:

- **One audio element.** `AudioEngine` owns the only `HTMLAudioElement`, the queue, shuffle/repeat, Media Session and Blob URL lifecycle. Each blob URL is revoked once the next source has been set. Components read its state through `useSyncExternalStore`. Playback progress is a separate store, so ticks of about 4 Hz re-render only the seek bar.
- **Blobs load on demand.** The library keeps metadata only. A track's audio Blob is read from IndexedDB when the track is played.
- **Use cases in one place.** UI components call `lib/library/actions.ts` and never touch repositories directly. Deleting a track, for example, updates IndexedDB, every playlist, the player queue and the stores together.
- **Static export plus precache.** Every route, RSC payload and chunk is precached under a versioned cache name. The service worker never caches audio and never intercepts cross-origin requests. An update waits until the user taps **Reload**, so playback is never interrupted.
- **Cache Components disabled.** `cacheComponents` was removed from the scaffold's config. `use cache` is unavailable with static export, and its `<Activity>` behaviour keeps hidden routes mounted, which conflicts with modal dialogs and the window-scroll virtual list.

### IndexedDB (`offline-music-db`, version 1)

| Store | Key | Indexes | Contents |
| --- | --- | --- | --- |
| `tracks` | `id` | `createdAt`, `fingerprint`, `contentHash` | Metadata, cover art Blob, favourite flag, play count, last played time |
| `audioFiles` | `trackId` | none | `{ trackId, blob }` |
| `playlists` | `id` | none | `{ id, name, trackIds, createdAt, updatedAt }` |
| `settings` | `key` | none | Theme, autoplay, repeat, shuffle, volume, speed, last track/position/queue, lock-screen buttons |

Each track's metadata and audio are written in a single transaction. If Safari has dropped the IndexedDB connection after the app was backgrounded, the wrapper reopens it and retries once.

### Duplicate detection

Detection runs in two steps, cheapest first:
1. A fingerprint: `name + size + lastModified` for files, or the normalised URL for remote imports. Remote duplicates are caught before downloading.
2. A SHA-256 content hash. Files up to 32 MB are hashed in full. Larger files are hashed from their size plus three 2 MB samples, so the whole file is never read into memory.

Web Crypto only exists in secure contexts, so over plain-HTTP LAN testing only the fingerprint check runs.

## How to run (Windows)

```powershell
npm install
npm run dev          # http://localhost:3000 (UI development; no offline support)
npm run build        # production build to out/
npm run serve        # http://localhost:3000 serving the production build (offline works on localhost)
```

To test offline on desktop: run `npm run build` and `npm run serve`, open http://localhost:3000, and wait until **Settings → Offline** says *Ready*. Then turn off the network (DevTools → Network → Offline) and reload.

## Testing on iPhone

Service workers, `crypto.subtle` and persistent storage require a **secure context**. `http://192.168.x.x` is not one, so offline mode will not work over plain HTTP on the LAN. There are two ways to test.

### Option A: HTTPS on your local network (recommended)

1. Install [mkcert](https://github.com/FiloSottile/mkcert) on the PC, then run:
   ```powershell
   mkcert -install
   mkdir certs
   mkcert -cert-file certs/cert.pem -key-file certs/key.pem 192.168.1.20 localhost
   ```
   Replace `192.168.1.20` with your PC's IPv4 address (`ipconfig`). `*.pem` and `certs/` are git-ignored.
2. Trust the mkcert root CA on the iPhone:
   - Run `mkcert -CAROOT` to find the folder, then send **only `rootCA.pem`** to the phone (email or iCloud Drive). **Never copy `rootCA-key.pem`** anywhere.
   - On the iPhone, open the file, then install it in **Settings → General → VPN & Device Management**.
   - Enable it under **Settings → General → About → Certificate Trust Settings**.
3. Build and serve over HTTPS:
   ```powershell
   npm run build
   $env:HTTPS_CERT="certs/cert.pem"; $env:HTTPS_KEY="certs/key.pem"; npm run serve
   ```
   The server prints the LAN URL, for example `https://192.168.1.20:3443`. Allow Node.js through Windows Defender Firewall on **private** networks when asked.
4. On the iPhone in Safari, open that URL, tap **Share → Add to Home Screen**, then launch the app from the Home Screen.
5. Remove the mkcert profile from the iPhone when you have finished testing.

### Option B: deploy the static export

Upload `out/` to any static HTTPS host. The host must:
- map clean URLs to HTML files (`/library` serves `library.html`), and
- serve `/sw.js` and the HTML pages with `Cache-Control: no-cache`.

The security headers used by `scripts/serve.mjs` are a reasonable starting point. `connect-src` allows `https:` because remote import fetches user-supplied URLs; remove it if you disable that feature. Also confirm the host's region and privacy obligations meet your requirements: user audio stays on the device, but your access logs may not.

### Development server over the LAN (no offline)

```powershell
$env:DEV_ORIGINS="192.168.1.20"; npm run dev -- -H 0.0.0.0
```
This is useful for checking layout on the phone. IndexedDB works, but the service worker, content hashing and persistence do not.

### iPhone acceptance checklist

- [ ] Add to Home Screen; launches standalone with no Safari UI; the status bar and home indicator don't overlap content.
- [ ] Import an MP3 or M4A from Files; title, artist and artwork are read.
- [ ] Tap a track; audio plays and the mini player appears; navigating between tabs keeps it playing.
- [ ] Lock the screen: playback continues; lock screen and Control Center show title, artist and artwork; play/pause and next/previous work.
- [ ] Let a track end while locked; the next track starts.
- [ ] Bluetooth headphones or car: play/pause/next work.
- [ ] Airplane Mode, then force-quit and relaunch: the library appears and tracks play.
- [ ] Create a playlist, add tracks, play and shuffle it.
- [ ] Settings shows storage used/quota; "Ask to keep my music stored" reports a result.

## iOS behaviour and limitations

These describe expected WebKit behaviour. **None has yet been checked on a device for this app.**

- **Background playback and lock screen.** Recent iOS versions support audio continuing in the background for Home Screen web apps, plus Media Session metadata and controls. Behaviour has varied between iOS releases; reported problems include playback stopping after a long time in the background and controls disappearing after the app is suspended. A web app cannot request the background-audio entitlement a native app has.
- **Lock-screen buttons.** iOS shows either previous/next-track buttons or ±seek buttons. The app registers the seek handlers only when **Settings → Lock screen buttons → Skip 10 s** is selected.
- **Autoplay.** Safari starts media only from a user gesture. The engine plays a silent clip synchronously on the first tap so later asynchronous starts are allowed, including advancing to the next track while locked. If a start is still blocked, the player shows Play rather than an error.
- **Volume.** iOS ignores `audio.volume`; the app detects this and hides the volume slider, so the hardware buttons control volume.
- **Storage quota and eviction.** WebKit sets quotas per origin, and the Settings screen shows the browser's estimate. Safari can evict data for sites that haven't been used for a while. Home Screen apps are treated separately from Safari tabs, and the app calls `navigator.storage.persist()` after the first import, but the browser may decline. **Keep your original audio files**: this app is not a backup.
- **Separate storage.** A Home Screen app and Safari tabs keep separate storage, so music imported in Safari does not appear in the installed app. Import from inside the installed app.
- **Large files.** Each file is limited to 300 MB (`MAX_IMPORT_BYTES`). Remote downloads are buffered in memory before saving, which can fail for very large files on older devices.
- **Formats.** MP3, AAC/M4A and WAV play everywhere. OGG/Opus, WebM and FLAC support depends on the iOS version; the app warns after import if `canPlayType` reports a format as unsupported.
- **Duration.** iOS often won't load media metadata without a gesture. The app reads duration from MP3/MP4 headers instead, and records the browser-reported duration on first playback.
- **Lock-screen artwork.** Cover art is passed to Media Session as a `blob:` URL. If iOS doesn't display it, the fallback is the app icon (used only when a track has no cover).

## Known issue worked around

On Windows, Next.js 16.4's static export writes segment-prefetch files using backslash paths, producing `settings/__next.settings/__PAGE__.txt`. The client requests `settings/__next.settings.__PAGE__.txt`. `scripts/build-sw.mjs` flattens these files after the build; on Linux and macOS this step does nothing.

## Future improvements

- Playwright end-to-end tests in CI, including WebKit.
- Drag to reorder playlists and the queue.
- Folder import (`webkitdirectory`) and bulk tag editing.
- Vorbis comment / FLAC tag reading.
- Export and import of the library manifest (playlists and settings) for backup.
- Gapless playback and crossfade (would need Web Audio, with care on iOS).
