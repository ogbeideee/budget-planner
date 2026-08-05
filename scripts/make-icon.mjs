// Generates build/icon.png (512x512 master) and build/icon.ico (multi-size
// PNG-compressed entries: 16, 24, 32, 48, 64, 128, 256) from a vector-style
// drawing, pure Node (zlib + manual PNG/ICO framing), no image dependencies.
//
// Art: indigo rounded square with a diagonal brand gradient, a white coin
// bearing a subtle rim and three ascending bars (growth / budgeting motif).
// Master is drawn at 512px with 4x4 supersampled anti-aliasing and box-
// downsampled to each target size, so small sizes stay clean.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "build");
mkdirSync(buildDir, { recursive: true });

const MASTER = 512;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// Brand palette (app/globals.css)
const BRAND_400 = [0x7c, 0x86, 0xda, 255];
const BRAND_500 = [0x5e, 0x6a, 0xd2, 255];
const BRAND_600 = [0x4b, 0x53, 0xb8, 255];
const BRAND_700 = [0x3d, 0x44, 0x96, 255];
const BRAND_800 = [0x33, 0x39, 0x76, 255];
const BRAND_950 = [0x1c, 0x1f, 0x40, 255];
const WHITE = [0xff, 0xff, 0xff, 255];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Signed distance to a rounded rectangle (negative inside).
function sdRoundRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius);
  const qy = Math.abs(py - cy) - (halfH - radius);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    radius
  );
}

// Background gradient: brand-500 (top-left) -> brand-600 (center) -> brand-800 (bottom-right).
function bgColor(x, y) {
  const t = (x + y) / (2 * (MASTER - 1));
  if (t < 0.5) {
    const s = smoothstep(0, 0.5, t);
    return [
      lerp(BRAND_500[0], BRAND_600[0], s),
      lerp(BRAND_500[1], BRAND_600[1], s),
      lerp(BRAND_500[2], BRAND_600[2], s),
      255,
    ];
  }
  const s = smoothstep(0.5, 1, t);
  return [
    lerp(BRAND_600[0], BRAND_800[0], s),
    lerp(BRAND_600[1], BRAND_800[1], s),
    lerp(BRAND_600[2], BRAND_800[2], s),
    255,
  ];
}

// Ascending bars inside the coin: [x0, x1, top, bottom, color]
function bars() {
  const cy = 252;
  const bottom = cy + 78;
  const gap = 20;
  const width = 44;
  const total = 3 * width + 2 * gap;
  const x0 = MASTER / 2 - total / 2;
  const heights = [66, 96, 122];
  const colors = [BRAND_400, BRAND_500, BRAND_600];
  return heights.map((h, i) => ({
    x0: x0 + i * (width + gap),
    x1: x0 + i * (width + gap) + width,
    top: bottom - h,
    bottom,
    color: colors[i],
  }));
}

function sample(x, y) {
  // Background (rounded square) coverage.
  const bgCoverage = smoothstep(
    1,
    -1,
    sdRoundRect(x, y, MASTER / 2, MASTER / 2, 208, 208, 96)
  );
  if (bgCoverage <= 0) return [0, 0, 0, 0];

  const cx = MASTER / 2;
  const cy = 252;
  const dCoin = Math.hypot(x - cx, y - cy);

  // Drop shadow: soft brand-950 ellipse just under the coin.
  const shadow = smoothstep(0, -18, Math.hypot(x - cx, y - (cy + 12)) - 152);
  let color = bgColor(x, y);
  if (shadow > 0 && dCoin > 150) {
    const s = shadow * 0.32;
    color = [
      lerp(color[0], BRAND_950[0], s),
      lerp(color[1], BRAND_950[1], s),
      lerp(color[2], BRAND_950[2], s),
      255,
    ];
  }

  // Coin.
  const coinEdge = smoothstep(1.5, -1.5, dCoin - 150);
  const shade = smoothstep(140, 150, dCoin); // edge shade: 0 inside, 1 at rim
  if (coinEdge > 0) {
    color = WHITE;
    if (shade > 0) {
      const t = shade * 0.45;
      color = [
        lerp(WHITE[0], BRAND_700[0], t),
        lerp(WHITE[1], BRAND_700[1], t),
        lerp(WHITE[2], BRAND_700[2], t),
        255,
      ];
    }
  }

  // Bars.
  for (const bar of bars()) {
    const dBar = sdRoundRect(x, y, (bar.x0 + bar.x1) / 2, (bar.top + bar.bottom) / 2, (bar.x1 - bar.x0) / 2, (bar.bottom - bar.top) / 2, 20);
    if (dBar < 0) {
      color = bar.color;
      break;
    }
  }

  return [color[0], color[1], color[2], Math.round(255 * bgCoverage)];
}

function drawMaster() {
  const px = new Uint8Array(MASTER * MASTER * 4);
  const SS = 4; // supersampling factor per axis
  for (let y = 0; y < MASTER; y += 1) {
    for (let x = 0; x < MASTER; x += 1) {
      const r = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const c = sample(
            x + (sx + 0.5) / SS,
            y + (sy + 0.5) / SS
          );
          r[0] += c[0];
          r[1] += c[1];
          r[2] += c[2];
          r[3] += c[3];
        }
      }
      const n = SS * SS;
      const i = (y * MASTER + x) * 4;
      px[i] = Math.round(r[0] / n);
      px[i + 1] = Math.round(r[1] / n);
      px[i + 2] = Math.round(r[2] / n);
      px[i + 3] = Math.round(r[3] / n);
    }
  }
  return px;
}

// Box-filter downsample of the RGBA master to `size` (edge pixels keep AA).
function downsample(master, size) {
  const out = new Uint8Array(size * size * 4);
  const scale = MASTER / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(MASTER, Math.ceil((x + 1) * scale));
      const y0 = Math.floor(y * scale);
      const y1 = Math.min(MASTER, Math.ceil((y + 1) * scale));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let py = y0; py < y1; py += 1) {
        for (let px = x0; px < x1; px += 1) {
          const i = (py * MASTER + px) * 4;
          const w = master[i + 3] / 255;
          r += master[i] * w;
          g += master[i + 1] * w;
          b += master[i + 2] * w;
          a += master[i + 3];
          count += 1;
        }
      }
      const i = (y * size + x) * 4;
      if (count === 0 || a === 0) continue;
      out[i] = Math.round(r / a);
      out[i + 1] = Math.round(g / a);
      out[i + 2] = Math.round(b / a);
      out[i + 3] = Math.round(a / count);
    }
  }
  return out;
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4); // image count
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width 0 => 256
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // palette colors
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // bytesInRes
    entry.writeUInt32LE(offset, 12); // image offset
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map(({ png }) => png)]);
}

const master = drawMaster();
const png = encodePng(master, MASTER);
writeFileSync(join(buildDir, "icon.png"), png);
const ico = encodeIco(
  ICO_SIZES.map((size) => ({
    size,
    png: encodePng(downsample(master, size), size),
  }))
);
writeFileSync(join(buildDir, "icon.ico"), ico);
console.log(
  `wrote build/icon.png (${png.length} bytes) and build/icon.ico (${ico.length} bytes, ${ICO_SIZES.join("/")}px)`
);
