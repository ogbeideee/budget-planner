// Statement-PDF builder used by the Phase D encrypted-import tests
// (tests/fixtures/statements/statementEncrypted.test.ts).
//
// Real password-protected bank statements cannot be sourced, so the tests
// build faithful stand-ins with mupdf:
//
//   - text-layer PDFs from the REAL statement layouts the parsers are tested
//     against (Kuda's grid in lib/__tests__/kudaParser.test.ts, OPay/GTCO's
//     export formats in their parser tests) — one row per line, cells placed
//     at fixed x positions;
//   - an encrypted copy of a REAL scanned statement (the Kuda fixture) —
//     only the encryption is synthesized, the bytes are the real PDF.
//
// Encryption is AES-256 (PDF 2.0) via mupdf's write options — the option
// names of the bundled mupdf build are `encrypt`, `user-password` and
// `owner-password` (verified against the wasm's option parser, which rejects
// unknown keys with "Unused pdf arguments found"). The password lives only in
// memory in this builder; it is never written anywhere.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import mupdf from "mupdf";

const require = createRequire(import.meta.url);

/** A REAL embeddable TrueType font (ships with pdfjs-dist). mupdf's base-14
 *  fonts are referenced by name, NOT embedded — pdfjs then needs the
 *  standardFontDataUrl to lay the text out (absent in jsdom), so the tests
 *  embed a real TTF instead: the text layer carries true glyph metrics and
 *  extracts identically in any environment. */
const EMBEDDED_FONT_BYTES: Uint8Array = new Uint8Array(
  readFileSync(require.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf")),
);

/** Encrypts existing PDF bytes (e.g. a real scanned fixture) with AES-256. */
export function encryptPdf(bytes: Uint8Array | ArrayBuffer, password: string): Uint8Array {
  // Copy into a plain Uint8Array: vitest's vm runner splits realms, so a
  // Node Buffer from readFileSync fails mupdf's `instanceof Uint8Array`
  // check ("not a Buffer or Stream") — the copy re-arms the test realm.
  const input = new Uint8Array(bytes);
  const doc = mupdf.Document.openDocument(input);
  const pdf = doc.asPDF();
  if (pdf === null) throw new Error("opened document is not a PDF");
  const out = pdf.saveToBuffer({
    encrypt: "aes-256",
    "user-password": password,
    "owner-password": password,
  });
  doc.destroy();
  return out.asUint8Array();
}

/** Builds a one-page text-layer PDF from a row grid. Cells are placed at the
 *  given x positions (every gap must exceed 40 units so pdfjs splits cells);
 *  rows are laid out top-down. */
export function buildStatementPdf(
  rows: readonly (readonly (string | undefined)[])[],
  colXs: readonly number[],
  options: { password?: string } = {},
): Uint8Array {
  const doc = new mupdf.PDFDocument();
  const font = new mupdf.Font("LiberationSans", EMBEDDED_FONT_BYTES);
  const fontObj = doc.addSimpleFont(font, "Latin");
  const resources = doc.newDictionary();
  const fontDict = doc.newDictionary();
  fontDict.put("F1", fontObj);
  resources.put("Font", fontDict);

  const ops: string[] = [];
  ops.push("BT");
  ops.push("/F1 10 Tf");
  let y = 800;
  for (const row of rows) {
    for (let i = 0; i < row.length; i += 1) {
      const cell = String(row[i] ?? "");
      if (cell === "") continue;
      const x = colXs[i] ?? colXs[colXs.length - 1];
      ops.push(`1 0 0 1 ${x} ${y} Tm`);
      ops.push(`(${escapePdfString(cell)}) Tj`);
    }
    y -= 14;
  }
  ops.push("ET");
  const contents = new mupdf.Buffer(ops.join("\n"));
  // Wide page: pdfjs clips text runs that overflow the page width, so the
  // canvas must comfortably fit the widest row (e.g. GTCO's 8 columns).
  const pageObj = doc.addPage([0, 0, 1240, 850], 0, resources, contents);
  doc.insertPage(0, pageObj);

  const saveOptions =
    options.password === undefined
      ? "compress=no"
      : {
          encrypt: "aes-256",
          "user-password": options.password,
          "owner-password": options.password,
        };
  const out = doc.saveToBuffer(saveOptions);
  doc.destroy();
  return out.asUint8Array();
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
