// Regenerates the vendored Tesseract.js OCR assets in public/vendor/tesseract/
// (Prompt 8D). The app loads these at runtime — worker, WASM core and English
// language data are served by the app itself, so OCR works fully offline and
// no bank statement ever leaves the device.
//
//   node scripts/fetch-ocr-assets.mjs
//
// Versions are pinned on purpose: bump deliberately, then re-verify the real
// Kuda statement with scripts/ocr-check.mjs.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TESSERACT_VERSION = "5.1.1";
const CORE_VERSION = "5.1.1";
const ENG_DATA = "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata";

const ASSETS = [
  {
    file: "tesseract.min.js",
    url: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`,
    size: "~67 KB",
  },
  {
    file: "worker.min.js",
    url: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`,
    size: "~124 KB",
  },
  {
    file: "tesseract-core-simd.wasm.js",
    url: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VERSION}/tesseract-core-simd.wasm.js`,
    size: "~4.7 MB (self-contained WASM)",
  },
  {
    file: "eng.traineddata",
    url: ENG_DATA,
    size: "~4 MB (tessdata_fast)",
  },
];

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor", "tesseract");
mkdirSync(outDir, { recursive: true });

for (const asset of ASSETS) {
  const response = await fetch(asset.url);
  if (!response.ok) {
    console.error(`FAILED ${asset.file}: HTTP ${response.status} from ${asset.url}`);
    process.exitCode = 1;
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(outDir, asset.file), bytes);
  console.log(`OK ${asset.file} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

console.log(`\nVendored OCR assets live in ${outDir}`);
console.log("Verify the real scanned Kuda statement: node scripts/ocr-check.mjs");