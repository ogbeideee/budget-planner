// Generates build/icon.ico (256x256, single PNG-compressed entry) and
// build/icon.png from a simple pixel drawing — indigo rounded square with a
// white coin bearing a brand ring. Pure Node (zlib + manual PNG/ICO framing),
// no image dependencies. Replace the drawing in `draw()` with real artwork
// whenever a designer icon exists; the packaging scripts just consume the files.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "build");
mkdirSync(buildDir, { recursive: true });

const SIZE = 256;
const BRAND = [0x4b, 0x53, 0xb8, 255]; // --color-brand-600
const BRAND_DARK = [0x3d, 0x44, 0x96, 255]; // --color-brand-700
const WHITE = [0xff, 0xff, 0xff, 255];

function draw() {
  const px = new Uint8Array(SIZE * SIZE * 4);
  const c = SIZE / 2;
  const corner = 56;
  const coinR = 78;
  const ringOuter = 50;
  const ringInner = 34;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const i = (y * SIZE + x) * 4;
      const rx = Math.max(corner - x, x - (SIZE - 1 - corner), 0);
      const ry = Math.max(corner - y, y - (SIZE - 1 - corner), 0);
      if (rx * rx + ry * ry > corner * corner) continue; // outside rounded square
      const dx = x - c;
      const dy = y - c;
      const d2 = dx * dx + dy * dy;
      let color = BRAND;
      if (d2 <= coinR * coinR) color = WHITE;
      if (d2 >= ringInner * ringInner && d2 <= ringOuter * ringOuter) {
        color = BRAND_DARK;
      }
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = color[3];
    }
  }
  return px;
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

function encodePng(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = SIZE * 4 + 1;
  const raw = Buffer.alloc(SIZE * stride);
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * stride] = 0; // filter: none
    Buffer.from(rgba.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 0 => 256
  entry[1] = 0; // height
  entry[2] = 0; // palette colors
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 6); // color planes
  entry.writeUInt16LE(32, 8); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image size (bytesInRes)
  entry.writeUInt32LE(22, 12); // image offset (6 header + 16 entry)
  return Buffer.concat([header, entry, png]);
}

const png = encodePng(draw());
writeFileSync(join(buildDir, "icon.png"), png);
writeFileSync(join(buildDir, "icon.ico"), encodeIco(png));
console.log(`wrote build/icon.png (${png.length} bytes) and build/icon.ico`);
