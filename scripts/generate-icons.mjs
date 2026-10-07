// Generates the PWA / Apple touch icons as PNGs without any image library:
// shapes are rasterised with 4x4 supersampling and encoded with node:zlib.
// Run with `npm run icons`; output goes to public/icons/.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("../public/icons/", import.meta.url);
const TOP = [0xff, 0x37, 0x5f];
const BOTTOM = [0xa8, 0x0d, 0x35];
const SAMPLES = 4;
// Centre of the note artwork's bounding box, mapped to the icon centre.
const NOTE_CENTRE = { x: 0.485, y: 0.45 };

// --- Shapes in unit coordinates (0..1) -------------------------------------

function inEllipse(x, y, cx, cy, rx, ry, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  const u = (dx * cos + dy * sin) / rx;
  const v = (-dx * sin + dy * cos) / ry;
  return u * u + v * v <= 1;
}

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

/** Beamed pair of eighth notes, centred in the unit square. */
function inNote(x, y) {
  const tilt = -0.35;
  // Beam: a slanted band between the two stems.
  const beamTop = 0.22 + (x - 0.38) * -0.18;
  const inBeam = x >= 0.375 && x <= 0.735 && y >= beamTop && y <= beamTop + 0.085;
  return (
    inBeam ||
    inRect(x, y, 0.375, 0.22, 0.425, 0.66) ||
    inRect(x, y, 0.685, 0.155, 0.735, 0.6) ||
    inEllipse(x, y, 0.33, 0.68, 0.105, 0.075, tilt) ||
    inEllipse(x, y, 0.64, 0.615, 0.105, 0.075, tilt)
  );
}

function inRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

// --- Rasteriser -------------------------------------------------------------

function render(size, { radius, noteScale }) {
  const pixels = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let note = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;
          if (radius === 0 || inRoundedSquare(x, y, radius)) bg++;
          const nx = NOTE_CENTRE.x + (x - 0.5) / noteScale;
          const ny = NOTE_CENTRE.y + (y - 0.5) / noteScale;
          if (inNote(nx, ny)) note++;
        }
      }
      const total = SAMPLES * SAMPLES;
      const t = (px + py) / (2 * size);
      const base = TOP.map((c, i) => c + (BOTTOM[i] - c) * t);
      const n = note / total;
      const i = (py * size + px) * 4;
      pixels[i] = Math.round(base[0] * (1 - n) + 255 * n);
      pixels[i + 1] = Math.round(base[1] * (1 - n) + 255 * n);
      pixels[i + 2] = Math.round(base[2] * (1 - n) + 255 * n);
      pixels[i + 3] = Math.round((bg / total) * 255);
    }
  }
  return pixels;
}

// --- PNG encoder --------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.subarray(y * size * 4, (y + 1) * size * 4)).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Output -------------------------------------------------------------------

const ICONS = [
  // Rounded, transparent corners for browsers that don't mask icons.
  { file: "icon-192.png", size: 192, radius: 0.22, noteScale: 1 },
  { file: "icon-512.png", size: 512, radius: 0.22, noteScale: 1 },
  // Full-bleed with the note inside the 80% maskable safe zone.
  { file: "icon-maskable-512.png", size: 512, radius: 0, noteScale: 0.75 },
  // iOS rounds the corners itself and shows transparency as black.
  { file: "apple-touch-icon.png", size: 180, radius: 0, noteScale: 0.9 },
];

mkdirSync(OUT, { recursive: true });
for (const icon of ICONS) {
  writeFileSync(new URL(icon.file, OUT), encodePng(icon.size, render(icon.size, icon)));
  console.log(`wrote public/icons/${icon.file}`);
}
