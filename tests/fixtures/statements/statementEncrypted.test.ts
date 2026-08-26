// Real-engine tests for PASSWORD-PROTECTED statement PDFs (Phase D).
//
// These tests exercise the REAL engines against REAL bytes — the pdfjs
// legacy build (exactly the parsing engine the app uses, see
// statementRealEngine.test.ts), mupdf-built encrypted PDFs, and for the
// scanned path the REAL Kuda fixture (only encrypted in-memory) with its
// REAL OCR output (kuda.ocr.txt) standing in for the local OCR service.
//
// What is exercised end to end:
//
//   - an encrypted PDF with no password  → PdfPasswordError "needs-password"
//   - an encrypted PDF with a wrong one  → PdfPasswordError "incorrect-password"
//   - the correct password unlocks and the text layer flows into the normal
//     pipeline (text path — Kuda, OPay, GTCO);
//   - the correct password unlocks and a scanned statement routes to the OCR
//     path (scanned path — the real Kuda fixture);
//   - the same synthesized statements import UNENCRYPTED (regression: the
//     synthesis is faithful, nothing about encryption changes parsing).
//
// The passwords exist only in these tests' memory — nothing is persisted or
// logged (the app's own no-logging contract is asserted in
// ImportStatementModal.test.tsx).

import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

// pdfjs-dist's MODERN build requires browser APIs jsdom lacks; the LEGACY
// build is the same parsing engine with Node-compatible shims. The app keeps
// importing the modern build; this platform-dependent test routes the SAME
// runtime path at the legacy build (see statementRealEngine.test.ts).
vi.mock("pdfjs-dist", async () => {
  const legacy = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return legacy;
});

// ---------------------------------------------------------------------------
// Test-side DOMMatrix shim (jsdom gap, not an app gap) — same as
// statementRealEngine.test.ts.
// ---------------------------------------------------------------------------

interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function mul(a: Affine, b: Affine): Affine {
  return {
    a: a.a * b.a + a.c * b.b,
    b: a.b * b.a + a.d * b.b,
    c: a.a * b.c + a.c * b.d,
    d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e,
    f: a.b * b.e + a.d * b.f + a.f,
  };
}

function identity(): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

class DomMatrixShim implements Affine {
  a!: number;
  b!: number;
  c!: number;
  d!: number;
  e!: number;
  f!: number;

  constructor(init?: string | number[] | null) {
    const m = identity();
    if (typeof init === "string") {
      const match = /matrix\(\s*([-\d.eE+]+)[,\s]+([-\d.eE+]+)[,\s]+([-\d.eE+]+)[,\s]+([-\d.eE+]+)[,\s]+([-\d.eE+]+)[,\s]+([-\d.eE+]+)\s*\)/.exec(
        init,
      );
      if (match) {
        const [a, b, c, d, e, f] = match.slice(1).map(Number);
        Object.assign(m, { a, b, c, d, e, f });
      }
    } else if (Array.isArray(init) && init.length >= 6) {
      Object.assign(m, { a: init[0], b: init[1], c: init[2], d: init[3], e: init[4], f: init[5] });
    }
    Object.assign(this, m);
  }

  multiply(other: DomMatrixShim): DomMatrixShim {
    return new DomMatrixShim([...Object.values(mul(this, other))]);
  }

  multiplySelf(other: DomMatrixShim): DomMatrixShim {
    Object.assign(this, mul(this, other));
    return this;
  }

  preMultiplySelf(other: DomMatrixShim): DomMatrixShim {
    Object.assign(this, mul(other, this));
    return this;
  }

  translate(x: number, y: number): DomMatrixShim {
    return new DomMatrixShim([...Object.values(mul(this, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }))]);
  }

  scale(x: number, y: number): DomMatrixShim {
    return new DomMatrixShim([...Object.values(mul(this, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }))]);
  }

  invertSelf(): DomMatrixShim {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-12) return this;
    const inv = {
      a: d / det,
      b: -b / det,
      c: -c / det,
      d: a / det,
      e: (c * f - d * e) / det,
      f: (b * e - a * f) / det,
    };
    Object.assign(this, inv);
    return this;
  }

  transformPoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.a * point.x + this.c * point.y + this.e,
      y: this.b * point.x + this.d * point.y + this.f,
    };
  }
}

const globalThisWithDom = globalThis as typeof globalThis & {
  DOMMatrix?: unknown;
};
if (globalThisWithDom.DOMMatrix === undefined) {
  globalThisWithDom.DOMMatrix = DomMatrixShim as unknown as typeof DOMMatrix;
}

// ---------------------------------------------------------------------------
// Imports (after the shims, mirroring the real-engine test).
// ---------------------------------------------------------------------------

import {
  classifyPdfDocument,
  extractStatementRowsWithOcr,
  type OcrOptions,
} from "../../../lib/statementOcr";
import { processStatement } from "../../../lib/statementPipeline";
import { PdfPasswordError } from "../../../lib/statementPdf";
import type { OcrImage, OcrService } from "../../../lib/ocrService";
import type { NormalizationContext } from "../../../lib/statementTypes";
import { buildStatementPdf, encryptPdf } from "./buildPdf";
import { findFixture, fixturePdfPath, loadFixtureOcrText } from "./manifest";

const CONTEXT: NormalizationContext = { currency: "NGN" };
const PASSWORD = "secret123";

/** Exact-sized copy of a Node Buffer in the TEST realm (pdfjs refuses
 *  cross-realm buffers). */
function exactArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

/** OCR service stub: available, returns the REAL OCR output of the scanned
 *  Kuda fixture on the FIRST page only (the fixture spans 2 pages; serving
 *  the whole text on every page would duplicate every transaction). Only
 *  image recognition is stubbed, the text is real. */
function ocrServiceWith(text: string): OcrService {
  return {
    name: "Fixture OCR",
    isAvailable: vi.fn().mockResolvedValue(true),
    recognize: vi.fn(async (_image: OcrImage, page: number) => (page === 1 ? text : "")),
  };
}

/** Page renderer stub — pdfjs pages are never rendered in jsdom. */
function stubRenderer() {
  return vi.fn(async () => ({ width: 2, height: 2, data: new Uint8ClampedArray(16) }));
}

function pdfFile(bytes: Uint8Array, name = "Statement.pdf"): File {
  return new File([exactArrayBuffer(bytes)], name, { type: "application/pdf" });
}

function baseOcrOptions(overrides: Partial<OcrOptions> = {}): OcrOptions {
  return {
    service: ocrServiceWith(""),
    renderPage: stubRenderer(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Statement layouts — the REAL export formats the parsers are tested against
// (lib/__tests__/*Parser.test.ts), with amounts stripped of the ₦ sign
// (Helvetica's Latin encoding cannot print it; the pipeline's header
// tokenizer and amount parser treat ₦-less cells identically).
// ---------------------------------------------------------------------------

/** Kuda text-layout grid (kudaParser.test.ts TEXT_BASED_GRID). */
const KUDA_GRID: string[][] = [
  ["Account Number", "Date"],
  ["DAVID OSAHON OGBEIDE", "2003640955", "01/07/2026 - 14/08/2026"],
  ["2 OLABISI STREET, IKOSI KETU, KOSOFE, LAGOS, 105102, NIGERIA"],
  ["Opening Balance", "Closing Balance"],
  ["44.33", "69.33"],
  ["Summary"],
  ["Type", "Opening Balance", "Closing Balance"],
  ["Spend Account", "14.33", "29.33"],
  ["Spend + Save (1 Pocket)", "30.00", "840.00"],
  ["Spend Account"],
  ["Money In", "Money Out", "Opening Balance", "Closing Balance"],
  ["2,925.00", "2,910.00", "14.33", "29.33"],
  ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
  ["01/08/26", "2,925.00", "", "local funds transfer", "Sporty Internet Ltd", "Disbursment/3000127755/Kuda sportybet", "2,939.33"],
  ["13:05:08", "transfer", "Disbursment/3000127755/Kuda", "sportybet"],
  ["02/08/26", "", "2,800.00", "outward transfer", "David Osahon Ogbeide", "Ogbeide/0242986234/Wema Bank", "139.33"],
  ["21:39:58", "transfer", "Ogbeide/0242986234/Wema", "Bank"],
  ["04/08/26", "", "100.00", "outward transfer", "Digital Services Limited", "Ogbeide/8082389369/Opay", "839.33"],
  ["16:53:03", "transfer", "Ogbeide/8082389369/Opay", "Digital Services Limited"],
  ["04/08/26", "", "10.00", "spend and save", "ogbeide david-", "and save", "29.33"],
  ["16:53:03", "save"],
  ["Spend + Save"],
  ["Money In", "Money Out", "Opening Balance", "Closing Balance"],
  ["10.00", "830.00", "", "640.00"],
  ["Date/Time", "Money In", "Money Out", "To", "Description", "Balance"],
  ["04/08/26", "", "10.00", "Spend + Save", "ogbeide david- and save", "840.00"],
  ["16:53:03", "and", "save"],
  ["Page 1 of 1"],
];

const KUDA_COLS = [50, 130, 210, 290, 370, 450, 530];

// A PDF text layer has no empty cells — a blank column slot emits no text
// run, so pdfjs extraction left-packs the row and the columnar engine's
// misalignment guards reject it (this is a real app limitation: columnar PDFs
// with blank money cells import zero rows). Synthesized columnar grids must
// therefore be SINGLE-SIDED with the money columns LAST — the blank side is
// the trailing cell, dropped harmlessly, and the amount lands at the
// remaining money column's index. OPay's grid is debit-only, GTCO's
// credit-only, so both directions still flow through the shared engine.

/** OPay export format (opayParser.test.ts HEADER + row shapes) — debit-only:
 *  Debit is the trailing money column; Credit is omitted entirely. */
const OPAY_GRID: string[][] = [
  ["Trans. Time", "Value Date", "Description", "Balance After", "Channel", "Transaction Reference", "Debit"],
  ["12/08/2026 09:41:23", "12/08/2026", "Transfer to DAVID OSAHON OGBEIDE | PalmPay", "1,200,000.00", "OPay App", "OP-REF-0001", "500,000.00"],
  ["12/08/2026 10:05:41", "12/08/2026", "Mobile Data | MTN | 3.2GB 2 Days Plan", "950,000.00", "OPay App", "OP-REF-0002", "250,000.00"],
  ["12/08/2026 11:30:02", "12/08/2026", "Transfer from CHI | GTBank", "700,000.00", "OPay App", "OP-REF-0003", "250,000.00"],
];

// Column starts, wide enough that every adjacent pair is separated by more
// than 6 units (pdfjs run split) and more than 40 units (the cell-split
// threshold caps at 40) — see groupPdfRows in lib/statementImport.ts.
const OPAY_COLS = [40, 140, 250, 520, 610, 700, 880];

/** GTCO export format (gtcoParser.test.ts HEADER + row shapes) — credit-only:
 *  Credits sits before the trailing (blank) Debits column. */
const GTCO_GRID: string[][] = [
  ["Trans. Date", "Value Date", "Reference", "Balance", "Originating Branch", "Remarks", "Credits", "Debits"],
  ["12/08/2026", "13/08/2026", "GT-REF-0001", "1,200,000.00", "VI 001", "RENT PAYMENT", "500,000.00"],
  ["12/08/2026", "13/08/2026", "GT-REF-0002", "3,200,000.00", "VI 001", "SALARY", "1,000,000.00"],
];

const GTCO_COLS = [40, 110, 190, 270, 350, 470, 580, 680];

describe("encrypted PDFs — unlock through the real engine (Phase D)", () => {
  it("encrypted text Kuda: needs-password, wrong password, then unlock → full pipeline", async () => {
    const bytes = buildStatementPdf(KUDA_GRID, KUDA_COLS, { password: PASSWORD });

    // No password → the classifier reports a locked document. (pdfjs detaches
    // the ArrayBuffer it is given, so every getDocument call gets a fresh copy.)
    const locked = await classifyPdfDocument(exactArrayBuffer(bytes));
    expect(locked.kind).toBe("encrypted");
    expect(locked.passwordStatus).toBe("needs-password");

    // Wrong password → rejected by the real engine.
    const wrong = await classifyPdfDocument(exactArrayBuffer(bytes), { password: "not-it" });
    expect(wrong.kind).toBe("encrypted");
    expect(wrong.passwordStatus).toBe("incorrect-password");

    // The routing seam throws the typed error the modal's password screen
    // understands — for no password and for a wrong one.
    await expect(
      extractStatementRowsWithOcr(pdfFile(bytes), baseOcrOptions()),
    ).rejects.toMatchObject({ name: "PdfPasswordError", status: "needs-password" });
    await expect(
      extractStatementRowsWithOcr(pdfFile(bytes), baseOcrOptions({ password: "not-it" })),
    ).rejects.toMatchObject({ name: "PdfPasswordError", status: "incorrect-password" });

    // Correct password: the text layer is read and flows through the pipeline.
    const extracted = await extractStatementRowsWithOcr(
      pdfFile(bytes),
      baseOcrOptions({ password: PASSWORD }),
    );
    expect(extracted.source).toBe("pdf");
    expect(extracted.ocr.ocrUsed).toBe(false);
    expect(extracted.cells.length).toBeGreaterThan(10);

    const preview = processStatement({
      cells: extracted.cells,
      context: CONTEXT,
      categories: [],
      rowYs: extracted.rowYs,
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("kuda");
    expect(preview.transactions).toHaveLength(5);
    expect(preview.transactions[0].creditAmount).toBe(292_500);
    expect(preview.transactions[0].transactionDate).toBe("2026-08-01");
  });

  it("encrypted text OPay unlocks and imports through the columnar parser", async () => {
    const bytes = buildStatementPdf(OPAY_GRID, OPAY_COLS, { password: PASSWORD });
    const extracted = await extractStatementRowsWithOcr(
      pdfFile(bytes),
      baseOcrOptions({ password: PASSWORD }),
    );
    expect(extracted.ocr.ocrUsed).toBe(false);

    const preview = processStatement({
      cells: extracted.cells,
      context: CONTEXT,
      categories: [],
      rowYs: extracted.rowYs,
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("opay");
    expect(preview.transactions).toHaveLength(3);
    expect(preview.transactions[0].debitAmount).toBe(50_000_000);
    expect(preview.transactions[1].provider).toBe("MTN");
    expect(preview.transactions[2].debitAmount).toBe(25_000_000);
  });

  it("encrypted text GTCO unlocks and imports through the columnar parser", async () => {
    const bytes = buildStatementPdf(GTCO_GRID, GTCO_COLS, { password: PASSWORD });
    const extracted = await extractStatementRowsWithOcr(
      pdfFile(bytes),
      baseOcrOptions({ password: PASSWORD }),
    );
    expect(extracted.ocr.ocrUsed).toBe(false);

    const preview = processStatement({
      cells: extracted.cells,
      context: CONTEXT,
      categories: [],
      rowYs: extracted.rowYs,
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("gtco");
    expect(preview.transactions).toHaveLength(2);
    expect(preview.transactions[0].creditAmount).toBe(50_000_000);
    expect(preview.transactions[1].creditAmount).toBe(100_000_000);
  });

  it("encrypted scanned Kuda (real fixture): wrong password, then unlock routes to the OCR path", async () => {
    const kuda = findFixture("kuda");
    const realBytes = encryptPdf(readFileSync(fixturePdfPath(kuda.id)), PASSWORD);
    const data = exactArrayBuffer(realBytes);

    // Locked and rejected without / with a wrong password.
    const locked = await classifyPdfDocument(data);
    expect(locked.kind).toBe("encrypted");
    expect(locked.passwordStatus).toBe("needs-password");
    await expect(
      extractStatementRowsWithOcr(pdfFile(realBytes), baseOcrOptions({ password: "not-it" })),
    ).rejects.toMatchObject({ name: "PdfPasswordError", status: "incorrect-password" });

    // Correct password → the document is scanned (no text layer) → the OCR
    // path runs (ocrUsed), fed by the REAL OCR output of this fixture.
    const extracted = await extractStatementRowsWithOcr(
      pdfFile(realBytes),
      baseOcrOptions({ password: PASSWORD, service: ocrServiceWith(loadFixtureOcrText("kuda")) }),
    );
    expect(extracted.ocr.ocrUsed).toBe(true);
    expect(extracted.ocr.failedPages).toEqual([]);
    expect(extracted.cells.length).toBeGreaterThan(20);

    const preview = processStatement({
      cells: extracted.cells,
      context: CONTEXT,
      categories: [],
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("kuda");
    expect(preview.transactions).toHaveLength(5);
  });

  it("unencrypted regression: the same synthesized statements import unchanged", async () => {
    const cases: Array<{ grid: string[][]; cols: number[]; bank: string }> = [
      { grid: KUDA_GRID, cols: KUDA_COLS, bank: "kuda" },
      { grid: OPAY_GRID, cols: OPAY_COLS, bank: "opay" },
      { grid: GTCO_GRID, cols: GTCO_COLS, bank: "gtco" },
    ];
    for (const c of cases) {
      const bytes = buildStatementPdf(c.grid, c.cols);
      const extracted = await extractStatementRowsWithOcr(
        pdfFile(bytes),
        baseOcrOptions(),
      );
      expect(extracted.ocr.ocrUsed).toBe(false);
      const preview = processStatement({
        cells: extracted.cells,
        context: CONTEXT,
        categories: [],
        rowYs: extracted.rowYs,
      });
      expect(preview.status).toBe("supported");
      expect(preview.detectedBank).toBe(c.bank);
      expect(preview.transactions.length).toBeGreaterThan(0);
    }
  });

  it("PdfPasswordError is the typed error the modal's password stage handles", async () => {
    const bytes = buildStatementPdf(OPAY_GRID, OPAY_COLS, { password: PASSWORD });
    const error = await extractStatementRowsWithOcr(
      pdfFile(bytes),
      baseOcrOptions(),
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PdfPasswordError);
    expect((error as PdfPasswordError).status).toBe("needs-password");
  });
});
