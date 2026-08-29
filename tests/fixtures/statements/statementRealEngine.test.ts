// Real-engine statement extraction tests (Prompt 8L).
//
// These tests exercise the REAL extraction engines against REAL bytes — no
// pdfjs/SheetJS mocks, no snapshots:
//
//   - pdfjs-dist (the modern browser build, exactly what the app imports)
//     reads the real PalmPay PDF (text layer) and the real Kuda PDF (scanned).
//   - SheetJS reads a real .xlsx workbook built in-memory.
//   - corrupt and empty inputs fail gracefully through the exact runtime
//     path the modal catches.
//
// PLATFORM-DEPENDENT by design (Prompt 8L): pdfjs-dist's modern build expects
// a browser-ish DOM. jsdom lacks `DOMMatrix` (used at module load and for
// canvas/pattern geometry), so this file installs a minimal, faithful 2D
// affine shim BEFORE the first import. In a real browser/Electron renderer
// the global comes from the platform — nothing here changes app code, and the
// ordinary unit suite never touches these tests' shims.

import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

// pdfjs-dist's MODERN build requires browser APIs jsdom lacks
// (DOMMatrix, Uint8Array.prototype.toHex). The pdfjs team ships the LEGACY
// build for Node.js ("Warning: Please use the legacy build in Node.js
// environments") — the same parsing engine, with Node-compatible shims.
// The app itself keeps importing the modern build (browser/Electron); this
// platform-dependent test routes the SAME runtime path (pdfRowsFromPdf's lazy
// import) at the LEGACY build so the real engine runs against the real bytes.
vi.mock("pdfjs-dist", async () => {
  const legacy = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return legacy;
});

// ---------------------------------------------------------------------------
// Test-side DOMMatrix shim (jsdom gap, not an app gap).
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
      // Column-major 2D or 3D array — pdfjs passes 6-element 2D arrays.
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
    return new DomMatrixShim([
      ...Object.values(mul(this, { a: 1, b: 0, c: 0, d: 1, e: x, f: y })),
    ]);
  }

  scale(x: number, y: number): DomMatrixShim {
    return new DomMatrixShim([
      ...Object.values(mul(this, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 })),
    ]);
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
// Real-bytes extraction.
// ---------------------------------------------------------------------------

import {
  extractStatementRows,
  pdfRowsFromPdf,
  rowsFromExcel,
  rowsFromPdf,
} from "../../../lib/statementImport";
import { detectStatementFormat, processStatement } from "../../../lib/statementPipeline";
import { classifyPdfDocument, needsOcr } from "../../../lib/statementOcr";
import type { NormalizationContext } from "../../../lib/statementTypes";
import { findFixture, fixturePdfPath } from "./manifest";

const CONTEXT: NormalizationContext = { currency: "NGN" };

/** Exact-sized copy of a Node Buffer in the TEST realm (Buffer.buffer is a
 *  Node-realm ArrayBuffer — `instanceof ArrayBuffer` fails across realms,
 *  and pdfjs's getDataProp refuses cross-realm buffers). */
function exactArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

describe("real pdfjs — the actual engine, the actual bytes (8L)", () => {
  it("extracts the real PalmPay text layer into statement cells", async () => {
    const palmpay = findFixture("palmpay");
    const rows = await pdfRowsFromPdf(exactArrayBuffer(readFileSync(fixturePdfPath(palmpay.id))));

    // The real statement: account header block + 75 transaction rows across 3
    // pages. The table header must be present in reading order.
    const joined = rows.map((row) => row.cells.join(" | "));
    expect(joined.length).toBeGreaterThan(50);
    expect(
      joined.some((line) => line.includes("Transaction Date") && line.includes("Transaction ID")),
    ).toBe(true);
    expect(joined.some((line) => line.includes("Total Money In"))).toBe(true);
  });

  it("turns the real PalmPay extraction into a supported PalmPay preview (full pipeline)", async () => {
    const palmpay = findFixture("palmpay");
    const extracted = await extractStatementRows(
      new File(
        [readFileSync(fixturePdfPath(palmpay.id))],
        "Statements download.pdf",
        { type: "application/pdf" },
      ),
    );

    expect(extracted.source).toBe("pdf");
    expect(extracted.rowYs).toBeDefined();
    expect(needsOcr(extracted.cells)).toBe(false);

    const preview = processStatement({
      cells: extracted.cells,
      context: CONTEXT,
      categories: [],
      rowYs: extracted.rowYs,
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("palmpay");
    expect(preview.transactions).toHaveLength(75);
    expect(preview.skipped).toBe(0);
    expect(preview.errors).toEqual([]);
  });

  it("real scanned Kuda PDF yields zero cells and needs OCR (no text layer)", async () => {
    const kuda = findFixture("kuda");
    const rows = await rowsFromPdf(exactArrayBuffer(readFileSync(fixturePdfPath(kuda.id))));

    // The scanned statement has no usable text layer: pdfjs only surfaces the
    // page-number footers, which collapse to zero cell rows.
    expect(rows).toEqual([]);
    expect(needsOcr(rows)).toBe(true);
    expect(detectStatementFormat(rows).bank).toBe("unknown");
  });

  it("real rasterized Kuda export PDF yields zero cells and needs OCR (image strips)", async () => {
    // KUDA-real.pdf is the same statement rendered as image strips — the
    // content stream draws ONLY image XObjects plus the page markers, so
    // pdfjs surfaces nothing a parser could read. Routing it to OCR is
    // correct (its real OCR parses as Kuda — see statementFixtures.test.ts);
    // pretending the text layer exists would be a fabrication.
    const kudaReal = findFixture("kuda-real");
    const rows = await rowsFromPdf(exactArrayBuffer(readFileSync(fixturePdfPath(kudaReal.id))));

    expect(rows).toEqual([]);
    expect(needsOcr(rows)).toBe(true);
    expect(detectStatementFormat(rows).bank).toBe("unknown");
  });

  it("rejects a corrupt PDF through the real engine (the modal's catch path)", async () => {
    await expect(rowsFromPdf(new ArrayBuffer(12))).rejects.toThrow();
    await expect(
      rowsFromPdf(exactArrayBuffer(Buffer.from("not a pdf at all"))),
    ).rejects.toThrow();
  });

  it("rejects an empty (zero-byte) PDF through the real engine", async () => {
    await expect(rowsFromPdf(new ArrayBuffer(0))).rejects.toThrow();
  });

  it("multi-page PDFs: every page is visited and the document is destroyed", async () => {
    // 3-page real statement — the extraction loop must visit all pages (the
    // PalmPay table rows appear on every page, so cells from all 3 pages are
    // present in order).
    const palmpay = findFixture("palmpay");
    const rows = await pdfRowsFromPdf(
      exactArrayBuffer(readFileSync(fixturePdfPath(palmpay.id))),
    );
    // Page footers "1" / "2" / "3" each appear as a lone item — the real
    // extraction covers all three pages (rows from page 3's transactions).
    const footerLike = rows.filter((row) => row.cells.length === 1 && /^\d$/.test(row.cells[0]));
    expect(footerLike.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// The MODAL's actual PDF seam (probe-seam regression, 2026-08-28).
// ---------------------------------------------------------------------------

describe("real Opay PDF through classifyPdfDocument — the seam the import modal actually uses", () => {
  // `classifyPdfDocument` used to build its cells with `rowsFromPdfItems`
  // per page — single-page alignment, anchors reset to null on EVERY page.
  // Every continuation page reprints no header, fell back to gap-based
  // splitting, and its drifted columns failed to parse: the real OPay
  // statement surfaced 124 of its 250 transactions in the live review screen
  // (406 rows reported "invalid date"/"unparseable amount") while every
  // snapshot-path test stayed green — the fixture loader threads anchors,
  // the probe did not. The probe now threads anchors exactly like
  // `pdfRowsFromPdf`; these tests read the REAL bytes through the REAL seam
  // so the two page loops can drift no more.
  const opay = findFixture("opay");

  it("threads column anchors across pages: all 250 transactions surface", async () => {
    const probe = await classifyPdfDocument(
      exactArrayBuffer(readFileSync(fixturePdfPath(opay.id))),
    );
    expect(probe.kind).toBe("text");

    const preview = processStatement({
      cells: probe.cells,
      context: CONTEXT,
      categories: [],
      rowYs: probe.rowYs,
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("opay");
    // The statement's own printed summary blocks: Wallet 77 debits + 73
    // credits, Savings 60 debits + 40 credits.
    expect(preview.transactions).toHaveLength(250);
    // Nothing vanishes silently: what fails to parse is REPORTED in review,
    // and it is only the five summary lines that resemble transaction starts
    // (the same five the snapshot path has always reported) — the money
    // totals reconcile to the penny without them (opayReal.test.ts).
    expect(preview.skipped).toBe(5);
    expect(preview.errors).toHaveLength(5);
  });

  it("extracts identically to pdfRowsFromPdf — the other runtime page loop", async () => {
    const probe = await classifyPdfDocument(
      exactArrayBuffer(readFileSync(fixturePdfPath(opay.id))),
    );
    const direct = await pdfRowsFromPdf(
      exactArrayBuffer(readFileSync(fixturePdfPath(opay.id))),
    );
    expect(probe.cells).toEqual(direct.map((row) => row.cells));
    expect(probe.rowYs).toEqual(direct.map((row) => row.y));
  });
});

describe("real SheetJS — the actual engine, actual xlsx bytes (8L)", () => {
  it("reads a real .xlsx workbook through rowsFromExcel", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Transaction Date", "Description", "Debit", "Credit"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00", ""],
      ["02/08/2026", "SHOPRITE", "85,250.00", ""],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const rows = await rowsFromExcel(bytes);
    expect(rows[0]).toEqual(["Transaction Date", "Description", "Debit", "Credit"]);
    expect(rows[1][0]).toBe("01/08/2026");
    expect(rows[2][1]).toBe("SHOPRITE");
  });

  it("uses the first sheet only, trimming every cell", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const first = XLSX.utils.aoa_to_sheet([
      ["Date", "Amount"],
      ["01/08/2026", " 10.00 "],
    ]);
    const second = XLSX.utils.aoa_to_sheet([["IGNORED"]]);
    XLSX.utils.book_append_sheet(workbook, first, "First");
    XLSX.utils.book_append_sheet(workbook, second, "Second");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const rows = await rowsFromExcel(bytes);
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("10.00");
  });

  it("extractStatementRows routes a real .xlsx File through SheetJS", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Transaction Date", "Debit", "Credit"],
        ["01/08/2026", "500.00", ""],
      ]),
      "Sheet1",
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([bytes], "statement.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const extracted = await extractStatementRows(file);
    expect(extracted.source).toBe("xlsx");
    expect(extracted.cells[1][0]).toBe("01/08/2026");

    const preview = processStatement({
      cells: extracted.cells,
      context: CONTEXT,
      categories: [],
    });
    // The generic columnar path reads the workbook: one transaction, debit
    // only, direction signalled by the Debit column.
    expect(preview.status).toBe("supported");
    expect(preview.transactions).toHaveLength(1);
    expect(preview.transactions[0].debitAmount).toBe(50_000);
  });
});

describe("real CSV — the actual runtime path (8L)", () => {
  it("extractStatementRows reads a real CSV File end to end", async () => {
    const file = new File(
      [
        "Trans. Date,Value Date,Reference,Debits,Credits,Balance,Originating Branch,Remarks\r\n" +
          "01/08/2026,01/08/2026,GT-001,5,000.00,,1,195,000.00,VI 001,ATM WITHDRAWAL\r\n" +
          "02/08/2026,02/08/2026,GT-002,,50,000.00,1,245,000.00,VI 001,TRANSFER FROM CHI\r\n",
      ],
      "statement.csv",
      { type: "text/csv" },
    );
    const extracted = await extractStatementRows(file);
    expect(extracted.source).toBe("csv");
    expect(extracted.cells).toHaveLength(3);
    expect(extracted.cells[1][3]).toBe("5,000.00");

    const preview = processStatement({
      cells: extracted.cells,
      context: CONTEXT,
      categories: [],
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("gtco");
    expect(preview.transactions).toHaveLength(2);
    expect(preview.transactions[0].debitAmount).toBe(500_000);
    expect(preview.transactions[1].creditAmount).toBe(5_000_000);
  });
});

describe("real GTCO password-protected PDF (8L)", () => {
  // GTCO-real-protected.pdf is the REAL protected statement (Standard
  // security handler, /V 2 /R 3 /Length 128 = RC4-128 — fully supported by
  // pdfjs). The password is USER-PROVIDED: the unlock test below reads it
  // from the GTCO_STATEMENT_PASSWORD environment variable and SKIPS cleanly
  // when it is unset (CI / anyone without the password). The password is
  // never printed, logged, persisted or asserted on — only the statements
  // the app would produce.
  const fixture = findFixture("gtco-real");
  const gtcoPassword = process.env.GTCO_STATEMENT_PASSWORD;

  it("without a password the probe reports a protected PDF (needs-password)", async () => {
    const probe = await classifyPdfDocument(
      exactArrayBuffer(readFileSync(fixturePdfPath(fixture.id))),
    );
    expect(probe.kind).toBe("encrypted");
    expect(probe.passwordStatus).toBe("needs-password");
  });

  it("with a WRONG password the probe reports an incorrect password", async () => {
    const probe = await classifyPdfDocument(
      exactArrayBuffer(readFileSync(fixturePdfPath(fixture.id))),
      { password: "wrong-password" },
    );
    expect(probe.kind).toBe("encrypted");
    expect(probe.passwordStatus).toBe("incorrect-password");
  });

  it.skipIf(gtcoPassword === undefined || gtcoPassword === "")(
    "with the REAL password the full runtime path yields 49 transactions",
    async () => {
      // pdfjs detaches the buffer it opens, so each test gets a fresh copy.
      const probe = await classifyPdfDocument(
        exactArrayBuffer(readFileSync(fixturePdfPath(fixture.id))),
        { password: gtcoPassword },
      );
      expect(probe.kind).toBe("text");

      const preview = processStatement({
        cells: probe.cells,
        context: CONTEXT,
        categories: [],
        rowYs: probe.rowYs,
      });
      expect(preview.status).toBe("supported");
      expect(preview.detectedBank).toBe("gtco");
      expect(preview.transactions).toHaveLength(49);
      expect(preview.skipped).toBe(0);
      expect(preview.errors).toEqual([]);
      // Only the FIRST account's table is imported (multi-account statement).
      for (const tx of preview.transactions ?? []) {
        expect(tx.row).toBeLessThan(105);
      }
    },
  );
});