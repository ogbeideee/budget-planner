// Manual REAL-OCR verification (Prompt 8D) — run outside vitest:
//
//   node scripts/ocr-check.mjs
//
// Renders the real scanned Kuda statement PDF (tests/fixtures/statements/Kuda)
// page by page with MuPDF (pure WASM), then OCRs each page with tesseract.js
// 5.1.1 using the exact vendored assets the app serves (public/vendor/
// tesseract/ — langPath + language data). The output is the same shape the
// app consumes: statement cells in page order.
//
// Optional arguments regenerate a fixture's OCR ground truth:
//
//   node scripts/ocr-check.mjs <pdfPath> <outTxtPath>
//
// e.g. node scripts/ocr-check.mjs tests/fixtures/statements/KUDA-real.pdf
//          tests/fixtures/statements/KUDA-real.ocr.txt
//
// Requires devDependencies: tesseract.js, mupdf
//   npm i -D tesseract.js@5.1.1 mupdf
//
// The APP itself renders with pdfjs in the browser (Path2D clip works there);
// MuPDF is only used here because pdfjs's canvas rendering cannot run in
// plain Node with @napi-rs/canvas (pdfjs's internal Path2D class is rejected
// by the native context).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import mupdf from "mupdf";
import { createWorker } from "tesseract.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PDF_PATH =
  process.argv[2] ?? join(
    ROOT,
    "tests",
    "fixtures",
    "statements",
    "Kuda",
    "Customer Statement.pdf",
  );
const OUT_PATH = process.argv[3] ?? null;
const LANG_PATH = join(ROOT, "public", "vendor", "tesseract");
const RENDER_SCALE = 3; // must match OCR_RENDER_SCALE in lib/statementOcr.ts

const bytes = readFileSync(PDF_PATH);
const pdfBytes = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const worker = await createWorker("eng", 1, {
  langPath: LANG_PATH,
  gzip: false, // vendored data is the plain (uncompressed) traineddata
});
console.log(`Language data from ${LANG_PATH}`);
console.log(`Rendering ${PDF_PATH} at ${RENDER_SCALE}x with MuPDF, then OCR (takes a while)…\n`);

const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
try {
  const allCells = [];
  const failedPages = [];
  let allText = "";
  for (let pageNumber = 1; pageNumber <= doc.countPages(); pageNumber += 1) {
    try {
      const pixmap = doc
        .loadPage(pageNumber - 1)
        .toPixmap([RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0], mupdf.ColorSpace.DeviceRGB, false);
      const png = pixmap.asPNG();

      const result = await worker.recognize(png);
      const text = result.data.text;
      allText += text;
      const cells = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => line.split(/\t|\s{2,}/).map((cell) => cell.trim()));

      console.log(`--- Page ${pageNumber} (${cells.length} OCR lines) ---`);
      for (const row of cells.slice(0, 8)) {
        console.log(`  | ${row.join(" | ")}`);
      }
      if (cells.length > 8) console.log(`  … (+${cells.length - 8} more lines)`);
      allCells.push(...cells);
    } catch (error) {
      failedPages.push(pageNumber);
      console.log(`--- Page ${pageNumber} FAILED: ${error.message} ---`);
    }
  }
  console.log(
    `\nTotal: ${allCells.length} OCR rows in page order (feed to the statement pipeline).`,
  );
  if (OUT_PATH !== null) {
    writeFileSync(OUT_PATH, allText, "utf8");
    console.log(`Wrote OCR ground truth to ${OUT_PATH}`);
  }
  if (failedPages.length > 0) {
    console.log(`Failed pages: ${failedPages.join(", ")} — rest of the statement is usable.`);
    process.exitCode = 1;
  }
} finally {
  await worker.terminate();
}