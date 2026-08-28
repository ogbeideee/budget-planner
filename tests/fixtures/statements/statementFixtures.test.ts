// Real-statement fixture tests (Prompt 8C).
//
// The real Kuda and PalmPay statement PDFs (tests/fixtures/statements/) are
// the source of truth — nothing here is synthesized. What these tests lock
// in:
//
// 1. Kuda's real PDF is a SCANNED statement (no text layer): pdfjs yields
//    only page markers, so the text-layer path reports it unsupported with
//    zero transactions — honest, nothing guessed. Prompt 8D added the OCR
//    fallback; the real OCR output (kuda.ocr.txt) is the ground truth that
//    Prompt 8E's parser must read (the Kuda describe below). The rasterized
//    export fixture (KUDA-real.pdf, the same statement rendered as image
//    strips) behaves identically — its REAL OCR text (KUDA-real.ocr.txt,
//    generated with the same tooling) parses to the same 5 transactions.
// 2. PalmPay's real PDF has a text layer. Its cells are detected as PalmPay
//    and parsed (Prompt 8J) — never mistaken for GTCO, OPay or Kuda, and no
//    optional field is fabricated.
// 3. A TEST-ONLY integrity lens reads the real extraction by COLUMN and
//    proves the fixture is complete and well-formed: exactly 75 transaction
//    rows, and the sums match the statement's own printed totals
//    (₦183,800.71 in / ₦340,270.00 out). The lens is deliberately NOT the
//    product parser; it exists to certify the fixture for that work.
// 4. Optional-field honesty: the real PalmPay statement carries a
//    Transaction ID and a counterparty, but NO running balance, NO category
//    column and NO value date — the parser keeps those absent, not
//    fabricated.
//
// Prompt 8J regression guard: each real statement must detect as its own
// bank (and only its own bank) — see statementPipeline.test.ts
// "cross-bank detection" for the synthetic cross-format matrix.

import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { detectStatementFormat, processStatement } from "../../../lib/statementPipeline";
import { supportedBankList } from "../../../lib/statementRegistry";
import type { NormalizationContext } from "../../../lib/statementTypes";
import { needsOcr, ocrTextToCells } from "../../../lib/statementOcr";
import { parseKudaStatement } from "../../../lib/kudaParser";
import { parseGtcoStatement } from "../../../lib/gtcoParser";
import {
  STATEMENT_FIXTURES,
  findFixture,
  fixtureAlignedCells,
  fixtureAlignedRowYs,
  fixtureCells,
  fixtureRowYs,
  fixturePdfPath,
  loadFixtureOcrText,
  loadFixtureSnapshot,
  type ExtractedPage,
  type PdfTextItem,
} from "./manifest";

const CONTEXT: NormalizationContext = { currency: "NGN" };

// ---------------------------------------------------------------------------
// Test-only integrity lens (Prompt 8C) — reads the REAL PalmPay extraction by
// column. NOT the product parser: it lives only here, to certify the fixture
// (row count, sums vs the statement's printed totals, column placement,
// optional-field presence/absence) before any parser work starts.
// ---------------------------------------------------------------------------

interface PalmPayColumn {
  x: number;
  name: string;
}

interface PalmPayRow {
  date: string;
  detail: string;
  /** Absolute minor units (printed "+1,234.56" → 123456). */
  moneyInMinor: number;
  moneyOutMinor: number;
  id: string;
}

const PALMPAY_DATE_RE = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} (AM|PM)$/;

/** Clusters the snapshot's items into y-lines, per page (pdfjs reuses the y
 *  range on every page), sorted in READING order (pdfjs y grows upward). */
function linesPerPage(pages: ExtractedPage[]): { y: number; items: PdfTextItem[] }[][] {
  return pages.map((page) => {
    const lines: { y: number; items: PdfTextItem[] }[] = [];
    for (const item of page.items) {
      if (item.str.trim() === "") continue;
      let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
      if (line === undefined) {
        line = { y: item.y, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    }
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
    }
    lines.sort((a, b) => b.y - a.y);
    return lines;
  });
}

const TABLE_HEADERS = [
  "Transaction Date",
  "Transaction Detail",
  "Money In (NGN)",
  "Money Out (NGN)",
  "Transaction ID",
] as const;

/** Column anchors from the statement's own 5-column table header. */
function findColumns(allLines: { y: number; items: PdfTextItem[] }[][]): PalmPayColumn[] {
  for (const pageLines of allLines) {
    for (const line of pageLines) {
      const names = line.items.map((item) => item.str);
      if (TABLE_HEADERS.every((header) => names.includes(header))) {
        return line.items
          .filter((item) => (TABLE_HEADERS as readonly string[]).includes(item.str))
          .map((item) => ({ x: item.x, name: item.str }));
      }
    }
  }
  throw new Error("PalmPay table header not found in the snapshot");
}

function columnAt(columns: PalmPayColumn[], x: number): string | null {
  let best: PalmPayColumn | null = null;
  let bestDistance = Infinity;
  for (const column of columns) {
    const distance = Math.abs(x - column.x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = column;
    }
  }
  return best !== null && bestDistance < 25 ? best.name : null;
}

/** Reads every transaction row of the real statement: a date line starts a
 *  row; detail/id continuation lines are attached to the nearest date line
 *  on the SAME page (wrapped cells sit a few y-units away; adjacent rows are
 *  25 units apart). */
function readPalmPayRows(
  pages: ExtractedPage[],
  columns: PalmPayColumn[],
): { rows: PalmPayRow[]; dateLineCount: number } {
  const allLines = linesPerPage(pages);
  const pagesWithLines = allLines;
  const dateLines = pagesWithLines.map((pageLines) =>
    pageLines.filter((line) => {
      const name = columnAt(columns, line.items[0]?.x ?? -1);
      return name === "Transaction Date" && PALMPAY_DATE_RE.test(line.items[0].str);
    }),
  );

  const attach = (pageIndex: number, line: { y: number; items: PdfTextItem[] }) => {
    let best: { y: number; items: PdfTextItem[] } | null = null;
    let bestDistance = 6;
    for (const candidate of dateLines[pageIndex]) {
      const distance = Math.abs(line.y - candidate.y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  };

  const rows: PalmPayRow[] = [];
  for (let pageIndex = 0; pageIndex < pagesWithLines.length; pageIndex += 1) {
    for (const dateLine of dateLines[pageIndex]) {
      const ownDetail = dateLine.items.filter(
        (item) => columnAt(columns, item.x) === "Transaction Detail",
      );
      const ownIds = dateLine.items.filter(
        (item) => columnAt(columns, item.x) === "Transaction ID",
      );
      const detailLines: { y: number; items: PdfTextItem[] }[] =
        ownDetail.length > 0 ? [{ y: dateLine.y, items: ownDetail }] : [];
      const idLines: { y: number; items: PdfTextItem[] }[] =
        ownIds.length > 0 ? [{ y: dateLine.y, items: ownIds }] : [];
      for (const line of pagesWithLines[pageIndex]) {
        if (line === dateLine) continue;
        if (attach(pageIndex, line) !== dateLine) continue;
        const detail = line.items.filter(
          (item) => columnAt(columns, item.x) === "Transaction Detail",
        );
        if (detail.length > 0) detailLines.push({ y: line.y, items: detail });
        const ids = line.items.filter((item) => columnAt(columns, item.x) === "Transaction ID");
        if (ids.length > 0) idLines.push({ y: line.y, items: ids });
      }
      detailLines.sort((a, b) => b.y - a.y);
      idLines.sort((a, b) => b.y - a.y);

      const moneyIn = dateLine.items.find(
        (item) => columnAt(columns, item.x) === "Money In (NGN)" && item.str.startsWith("+"),
      );
      const moneyOut = dateLine.items.find(
        (item) => columnAt(columns, item.x) === "Money Out (NGN)" && item.str.startsWith("-"),
      );
      const toMinor = (text: string) =>
        Math.round(parseFloat(text.slice(1).replace(/,/g, "")) * 100);

      rows.push({
        date: dateLine.items[0].str,
        detail: detailLines
          .flatMap((line) => line.items.map((item) => item.str))
          .join(" "),
        moneyInMinor: moneyIn === undefined ? 0 : toMinor(moneyIn.str),
        moneyOutMinor: moneyOut === undefined ? 0 : toMinor(moneyOut.str),
        id: idLines.flatMap((line) => line.items.map((item) => item.str)).join(" "),
      });
    }
  }
  return { rows, dateLineCount: dateLines.reduce((sum, list) => sum + list.length, 0) };
}

describe("statement fixtures (real PDFs)", () => {
  it("manifest entries reference real, non-empty PDFs", () => {
    expect(STATEMENT_FIXTURES).toHaveLength(5);
    for (const fixture of STATEMENT_FIXTURES) {
      const pdfPath = fixturePdfPath(fixture.id);
      expect(existsSync(pdfPath), `${fixture.id} PDF must exist`).toBe(true);
      expect(readFileSync(pdfPath).byteLength, `${fixture.id} PDF must not be empty`).toBeGreaterThan(
        0,
      );
      expect(loadFixtureSnapshot(fixture.id)).toHaveLength(fixture.pages);
    }
  });
});

describe("Kuda — real statement is a scanned PDF (no text layer)", () => {
  const kuda = findFixture("kuda");

  it("pdfjs extraction yields only the page markers", () => {
    const pages = loadFixtureSnapshot("kuda");
    expect(pages).toHaveLength(2);
    const markers = pages.flatMap((page) => page.items.map((item) => item.str));
    expect(markers).toEqual(["Page 1 of 2", "Page 2 of 2"]);
    expect(kuda.textLayer).toBe("absent");
  });

  it("runtime cells are empty — the app reads nothing from a scanned PDF", () => {
    // groupPdfLines drops single-item lines (no column gaps), so the real
    // Kuda PDF yields zero cells through the exact runtime path.
    expect(fixtureCells("kuda")).toEqual([]);
  });

  it("is never detected as GTCO or OPay", () => {
    const detection = detectStatementFormat(fixtureCells("kuda"));
    expect(detection.bank).toBe("unknown");
    expect(detection.reason).toBe("no bank header vocabulary found");
  });

  it("pipeline reports unsupported with zero transactions — nothing guessed", () => {
    const preview = processStatement({ cells: fixtureCells("kuda"), context: CONTEXT, categories: [] });
    expect(preview.status).toBe("unsupported");
    expect(preview.detectedBank).toBe("unknown");
    expect(preview.transactions).toEqual([]);
    expect(preview.skipped).toBe(0);
    expect(preview.errors).toEqual([]);
    expect(preview.unsupportedReason).toContain("matches none of the supported banks");
    expect(preview.unsupportedReason).toContain("Nothing was read");
  });
});

describe("Kuda — the real OCR output parses as a real statement (Prompt 8E)", () => {
  // kuda.ocr.txt is the ACTUAL OCR of the scanned PDF (scripts/ocr-check.mjs,
  // never hand-edited). The OCR text → cells conversion is the exact runtime
  // path (ocrTextToCells), and the parser is the exact runtime parser.
  const cells = ocrTextToCells(loadFixtureOcrText("kuda"));

  it("the OCR ground truth becomes one-cell-per-line cells (the 8D shape)", () => {
    expect(cells.length).toBeGreaterThan(20);
    // The statement itself starts at the account header block.
    expect(cells[0]).toEqual(["Account Number Date"]);
    expect(cells[11]).toEqual(["Money In Money Out Opening Balance Closing Balance"]);
    expect(cells[13]).toEqual([
      "Date/Time Money In Money Out Category To/From Description Balance",
    ]);
  });

  it("detects the statement as Kuda with high confidence", () => {
    const detection = detectStatementFormat(cells);
    expect(detection.bank).toBe("kuda");
    expect(detection.confidence).toBe("high");
  });

  it("parses the 5 real transactions — exact amounts, balances, times, rows", () => {
    const result = parseKudaStatement(cells, CONTEXT);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.transactions).toHaveLength(5);
    expect(result.transactions.map((tx) => tx.row)).toEqual([15, 17, 20, 23, 29]);

    const [tx1, tx2, tx3, tx4, tx5] = result.transactions;

    // Money in (local funds transfer) — delta chain decides the direction.
    expect(tx1.transactionDate).toBe("2026-08-01");
    expect(tx1.transactionTime).toBe("13:05:08");
    expect(tx1.creditAmount).toBe(292_500);
    expect(tx1.debitAmount).toBeUndefined();
    expect(tx1.balanceAfter).toBe(293_933);
    expect(tx1.direction).toBe("in");
    expect(tx1.sourceBank).toBe("kuda");
    expect(tx1.description).toContain("local funds");
    expect(tx1.description).toContain("Disbursment/3000127755/Kuda sportybet");

    // Money out — the delta chain decides again.
    expect(tx2.transactionDate).toBe("2026-08-02");
    expect(tx2.transactionTime).toBe("21:39:58");
    expect(tx2.debitAmount).toBe(280_000);
    expect(tx2.balanceAfter).toBe(13_933);
    expect(tx2.direction).toBe("out");
    expect(tx2.description).toContain("Ogbeide/0242986234/Wema");

    // OCR "#" naira sign; the mangled balance (839.33 ≠ chain) falls back to
    // the printed category tag — never a crash.
    expect(tx3.transactionDate).toBe("2026-08-04");
    expect(tx3.transactionTime).toBe("16:53:03");
    expect(tx3.debitAmount).toBe(10_000);
    expect(tx3.balanceAfter).toBe(83_933);
    expect(tx3.direction).toBe("out");
    expect(tx3.description).toContain("outward");

    expect(tx4.transactionDate).toBe("2026-08-04");
    expect(tx4.transactionTime).toBe("16:53:03");
    expect(tx4.debitAmount).toBe(1_000);
    expect(tx4.balanceAfter).toBe(2_933);
    expect(tx4.direction).toBe("out");
    expect(tx4.description).toContain("spend and spend and");

    // The Spend + Save pocket's own (Category-less) table.
    expect(tx5.transactionDate).toBe("2026-08-04");
    expect(tx5.transactionTime).toBe("16:53:03");
    expect(tx5.debitAmount).toBe(1_000);
    expect(tx5.balanceAfter).toBe(84_000);
    expect(tx5.direction).toBe("out");
    expect(tx5.description).toContain("Spend + Save");
    expect(tx5.description).toContain("ogbeide david-");
  });

  it("summary rows, totals rows and page footers never become transactions", () => {
    const result = parseKudaStatement(cells, CONTEXT);
    for (const tx of result.transactions) {
      expect(tx.description).not.toMatch(/^Summary/);
      expect(tx.description).not.toMatch(/^Page /);
      expect(tx.description.toLowerCase()).not.toContain("cea"); // footer junk
    }
    // The "Page N of 2" footers are ignored, not transactions.
    expect(result.transactions.length).toBe(5);
  });

  it("the full pipeline treats the OCR'd statement as supported Kuda", () => {
    const preview = processStatement({ cells, context: CONTEXT, categories: [] });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("kuda");
    expect(preview.transactions).toHaveLength(5);
    expect(preview.skipped).toBe(0);
    expect(preview.errors).toEqual([]);
  });
});

describe("Kuda-real — the rasterized export PDF reads through OCR (Prompt 8F)", () => {
  // KUDA-real.pdf is a DIFFERENT physical render of the same statement as the
  // scanned fixture (same account 2003640955, same period 01/07/2026 -
  // 14/08/2026): every page is image strips — the content stream draws only
  // image XObjects plus the page markers, so pdfjs has NO transaction text to
  // read. The app MUST route it to OCR (the existing scanned-Kuda path), and
  // its REAL OCR output (KUDA-real.ocr.txt — scripts/ocr-check.mjs tooling,
  // never hand-edited) must parse as the same 5 transactions.

  it("pdfjs extraction yields only the page markers", () => {
    const pages = loadFixtureSnapshot("kuda-real");
    expect(pages).toHaveLength(2);
    const markers = pages.flatMap((page) => page.items.map((item) => item.str));
    expect(markers).toEqual(["Page 1 of 2", "Page 2 of 2"]);
    expect(findFixture("kuda-real").textLayer).toBe("absent");
  });

  it("runtime cells are empty — no transaction text exists in the PDF", () => {
    expect(fixtureCells("kuda-real")).toEqual([]);
    expect(needsOcr(fixtureCells("kuda-real"))).toBe(true);
  });

  it("the real OCR of THIS file becomes the same statement cells as the scanned fixture", () => {
    const cells = ocrTextToCells(loadFixtureOcrText("kuda-real"));
    expect(cells.length).toBeGreaterThan(20);
    expect(cells[0]).toEqual(["Account Number Date"]);
    expect(cells[13]).toEqual([
      "Date/Time Money In Money Out Category To/From Description Balance",
    ]);
    // The Spend + Save pocket table (Category-less header) is present.
    expect(
      cells.some((row) => row[0] === "Date/Time Money In Money Out To Description Balance"),
    ).toBe(true);
  });

  it("detects as Kuda with high confidence", () => {
    const detection = detectStatementFormat(
      ocrTextToCells(loadFixtureOcrText("kuda-real")),
    );
    expect(detection.bank).toBe("kuda");
    expect(detection.confidence).toBe("high");
  });

  it("parses the 5 real transactions — exact amounts, balances, times, rows", () => {
    const cells = ocrTextToCells(loadFixtureOcrText("kuda-real"));
    const result = parseKudaStatement(cells, CONTEXT);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.transactions).toHaveLength(5);
    expect(result.transactions.map((tx) => tx.row)).toEqual([15, 17, 20, 23, 29]);

    const [tx1, tx2, tx3, tx4, tx5] = result.transactions;

    // Money in (local funds transfer) — the running-balance delta decides.
    expect(tx1.transactionDate).toBe("2026-08-01");
    expect(tx1.transactionTime).toBe("13:05:08");
    expect(tx1.creditAmount).toBe(292_500);
    expect(tx1.debitAmount).toBeUndefined();
    expect(tx1.balanceAfter).toBe(293_933);
    expect(tx1.direction).toBe("in");
    expect(tx1.description).toContain("local funds");
    expect(tx1.description).toContain("Disbursment/3000127755/Kuda");

    expect(tx2.transactionDate).toBe("2026-08-02");
    expect(tx2.transactionTime).toBe("21:39:58");
    expect(tx2.debitAmount).toBe(280_000);
    expect(tx2.balanceAfter).toBe(13_933);
    expect(tx2.direction).toBe("out");
    expect(tx2.description).toContain("Ogbeide/0242986234/Wema");

    expect(tx3.transactionDate).toBe("2026-08-04");
    expect(tx3.transactionTime).toBe("16:53:03");
    expect(tx3.debitAmount).toBe(10_000);
    expect(tx3.balanceAfter).toBe(83_933);
    expect(tx3.direction).toBe("out");
    expect(tx3.description).toContain("outward");

    expect(tx4.transactionDate).toBe("2026-08-04");
    expect(tx4.transactionTime).toBe("16:53:03");
    expect(tx4.debitAmount).toBe(1_000);
    expect(tx4.balanceAfter).toBe(2_933);
    expect(tx4.direction).toBe("out");
    expect(tx4.description).toContain("spend and spend and");

    // The Spend + Save pocket's own (Category-less) table.
    expect(tx5.transactionDate).toBe("2026-08-04");
    expect(tx5.transactionTime).toBe("16:53:03");
    expect(tx5.debitAmount).toBe(1_000);
    expect(tx5.balanceAfter).toBe(84_000);
    expect(tx5.direction).toBe("out");
    expect(tx5.description).toContain("Spend + Save");
  });

  it("summary rows, totals rows and page footers never become transactions", () => {
    const result = parseKudaStatement(
      ocrTextToCells(loadFixtureOcrText("kuda-real")),
      CONTEXT,
    );
    for (const tx of result.transactions) {
      expect(tx.description).not.toMatch(/^Summary/);
      expect(tx.description).not.toMatch(/^Page /);
      expect(tx.description.toLowerCase()).not.toContain("cea"); // footer junk
    }
    expect(result.transactions.length).toBe(5);
  });

  it("the full pipeline treats the rasterized statement as supported Kuda", () => {
    const preview = processStatement({
      cells: ocrTextToCells(loadFixtureOcrText("kuda-real")),
      context: CONTEXT,
      categories: [],
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("kuda");
    expect(preview.transactions).toHaveLength(5);
    expect(preview.skipped).toBe(0);
    expect(preview.errors).toEqual([]);
  });
});

describe("PalmPay — real statement with a text layer", () => {
  const palmpay = findFixture("palmpay");

  it("manifest documents the observed layout and optional fields", () => {
    expect(palmpay.textLayer).toBe("present");
    expect(palmpay.pages).toBe(3);
    // No running balance anywhere in this statement — a future parser must
    // not fabricate one (Prompt 8C: missing values are never forced).
    expect(palmpay.optionalFields).toEqual({
      balance: false,
      reference: true,
      counterparty: true,
      category: false,
      account: true,
      time: true,
      valueDate: false,
    });
  });

  it("real cells contain the account header block and the 5-column table header", () => {
    const cells = fixtureCells("palmpay");
    const joined = cells.map((row) => row.join(" | "));
    expect(joined.some((line) => line.includes("Account Statement"))).toBe(true);
    expect(joined.some((line) => line.includes("DAVID OSAHON OGBEIDE"))).toBe(true);
    expect(joined.some((line) => line.includes("Total Money In") && line.includes("183,800.71"))).toBe(
      true,
    );
    expect(joined.some((line) => line.includes("Total Money Out") && line.includes("340,270.00"))).toBe(
      true,
    );
    expect(cells).toContainEqual([
      "Transaction Date",
      "Transaction Detail",
      "Money In (NGN)",
      "Money Out (NGN)",
      "Transaction ID",
    ]);
  });

  it("is detected and parsed as PalmPay — never as GTCO, OPay or Kuda", () => {
    const detection = detectStatementFormat(fixtureCells("palmpay"));
    expect(detection.bank).toBe("palmpay");

    const preview = processStatement({
      cells: fixtureCells("palmpay"),
      context: CONTEXT,
      categories: [],
      rowYs: fixtureRowYs("palmpay"),
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("palmpay");
    expect(preview.transactions).toHaveLength(75);
    expect(preview.skipped).toBe(0);
    expect(preview.errors).toEqual([]);

    // Regression guard (Prompt 8J): a real PalmPay statement must never be
    // misdetected as another supported bank, and the supported-bank copy
    // (which the unsupported-format banner shows) includes PalmPay.
    expect(preview.unsupportedReason).toBeUndefined();
    expect(supportedBankList()).toContain("PalmPay");
  });

  describe("fixture integrity lens (test-only, not the parser)", () => {
    const pages = loadFixtureSnapshot("palmpay");
    const columns = findColumns(linesPerPage(pages));
    const { rows, dateLineCount } = readPalmPayRows(pages, columns);

    it("finds exactly the 5 table columns and no balance column", () => {
      expect(columns.map((column) => column.name)).toEqual([
        "Transaction Date",
        "Transaction Detail",
        "Money In (NGN)",
        "Money Out (NGN)",
        "Transaction ID",
      ]);
      expect(columns.some((column) => /balance/i.test(column.name))).toBe(false);
    });

    it("reads all 75 transaction rows and no false date matches", () => {
      expect(dateLineCount).toBe(75);
      expect(rows).toHaveLength(75);
    });

    it("sums exactly match the statement's own printed totals", () => {
      // Total Money In ₦183,800.71 · Total Money Out ₦340,270.00 (page 1).
      const totalIn = rows.reduce((sum, row) => sum + row.moneyInMinor, 0);
      const totalOut = rows.reduce((sum, row) => sum + row.moneyOutMinor, 0);
      expect(totalIn).toBe(18_380_071);
      expect(totalOut).toBe(34_027_000);
    });

    it("every row is well-formed: exactly one signed amount, a date, a detail and an id", () => {
      for (const row of rows) {
        expect(row.date).toMatch(PALMPAY_DATE_RE);
        expect(row.detail.trim()).not.toBe("");
        expect(row.id.trim()).not.toBe("");
        // '+' amounts live only in Money In, '−' only in Money Out; never both
        // and never neither (the lens already enforces the sign, so this is
        // an additional no-invention guard).
        const hasIn = row.moneyInMinor > 0;
        const hasOut = row.moneyOutMinor > 0;
        expect(hasIn !== hasOut, `row ${row.date} must have exactly one amount`).toBe(true);
      }
    });

    it("joins wrapped cells in reading order (real rows)", () => {
      const send = rows.find((row) => row.date === "08/12/2026 08:18:25 AM");
      expect(send?.detail).toBe("Send to FRIDAY PATIENCE NISMA");
      expect(send?.moneyOutMinor).toBe(40_000);
      expect(send?.moneyInMinor).toBe(0);
      expect(send?.id).toBe("03392cdb1501");

      const receive = rows.find((row) => row.date === "08/09/2026 07:20:06 PM");
      expect(receive?.detail).toBe("Received from DAVID OSAHON OGBEIDE");
      expect(receive?.moneyInMinor).toBe(120_000);
      expect(receive?.id).toBe("6038xn04ab06");

      const disbursement = rows.find((row) => row.date === "07/22/2026 06:43:31 AM");
      expect(disbursement?.detail).toBe("Disbursement-Installment loan");
      expect(disbursement?.moneyInMinor).toBe(3_500_000);

      const stampDuty = rows.find((row) => row.date === "08/09/2026 07:20:39 PM");
      expect(stampDuty?.detail).toBe("Stamp Duty");
      expect(stampDuty?.moneyOutMinor).toBe(5_000);
      // The reference wraps across two lines in the printed statement.
      expect(stampDuty?.id).toBe("20260809114820399392 0649447");
    });

    it("never mistakes the account header block for transactions", () => {
      // Name / Phone Number / Account Number / Total Money In / Statement
      // Period / Total Money Out / Print Time / Address sit outside the table
      // columns, so no lens row is built from them (75 date lines, 75 rows).
      expect(dateLineCount).toBe(rows.length);
    });
  });
});

describe("GTCO-real — the password-protected export PDF (Prompt 8L)", () => {
  // GTCO-real-protected.pdf is a REAL password-protected GTCO statement
  // (RC4-128 Standard security handler). Its text layer exists but emits NO
  // text for empty cells, so every row arrives SPARSE and misaligned when
  // left-packed; the runtime PDF path (rowsFromPdfItems) realigns rows by the
  // table header's column geometry. The snapshot (GTCO-real.extracted.json)
  // was captured from the real bytes; the tests below are the always-on
  // regression that locks the REAL statement's parsing in without needing the
  // unlock password (the snapshot is already decrypted).
  const aligned = fixtureAlignedCells("gtco-real");
  const alignedYs = fixtureAlignedRowYs("gtco-real");
  const gtco = findFixture("gtco-real");

  it("manifest documents the observed layout and optional fields", () => {
    expect(gtco.textLayer).toBe("present");
    expect(gtco.pages).toBe(5);
    expect(gtco.optionalFields).toEqual({
      balance: true,
      reference: true,
      counterparty: true,
      category: false,
      account: true,
      time: false,
      valueDate: true,
    });
  });

  it("the sparse text layer realigns into 8-column rows by the header geometry", () => {
    // The FIRST table header is the anchor page line (8 columnar tokens);
    // every following line re-slots into those columns, empties included.
    expect(aligned).toContainEqual([
      "Trans. Date",
      "Value Date",
      "Reference",
      "Debits",
      "Credits",
      "Balance",
      "Originating Branch",
      "Remarks",
    ]);
    // A real transaction row: sparse items land in their true columns — the
    // balance 21.79 in the Balance column (NOT left-packed into Credits), the
    // branch in the Originating Branch column.
    expect(aligned).toContainEqual([
      "01-Nov-2025",
      "01-Nov-2025",
      "'",
      ".20",
      "",
      "21.79",
      "INTL AIRPORT RD ISOLO",
      "",
    ]);
    // The account block of the FIRST account (page 1) is present in reading
    // order, before the table header.
    expect(aligned[0]).toEqual([
      "Statement Period",
      "01-Nov-2025-30-Nov-2025",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("the repeated table headers on pages 2-3 are section markers, not transactions", () => {
    const result = parseGtcoStatement(aligned, CONTEXT, alignedYs);
    // 49 REAL transactions from the FIRST account only.
    expect(result.transactions).toHaveLength(49);
    // A repeated header row would have produced a transaction named after the
    // header columns — none exists, and nothing is reported as skipped.
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("parses the 49 real transactions — exact dates, amounts, balances, narrations", () => {
    const result = parseGtcoStatement(aligned, CONTEXT, alignedYs);
    const byRow = new Map(result.transactions.map((tx) => [tx.row, tx]));

    // SMS charge: leading-dot amount, wrapped narration merged from lines
    // ABOVE and BELOW the row (the SMS block prints its remarks on its own
    // lines around the amount row).
    expect(byRow.get(12)?.transactionDate).toBe("2025-11-01");
    expect(byRow.get(12)?.debitAmount).toBe(20);
    expect(byRow.get(12)?.balanceAfter).toBe(2179);
    expect(byRow.get(12)?.description).toBe(
      "SMS ALERT CHARGE FOR 29-SEP-2025 to INTL AIRPORT RD ISOLO 28-OCT-2025Recover Partial Charges",
    );

    // The 80,000.00 credit: its narration block printed ABOVE the amount row
    // ('TRANSFER BETWEEN CUSTOMERS' + reference fragments) — the engine
    // attached it to THIS row, not the VAT row above it.
    expect(byRow.get(17)?.creditAmount).toBe(8_000_000);
    expect(byRow.get(17)?.balanceAfter).toBe(8_002_177);
    expect(byRow.get(17)?.direction).toBe("in");
    expect(byRow.get(17)?.description).toContain("TRANSFER BETWEEN CUSTOMERS");
    expect(byRow.get(17)?.description).toContain("BESTAF TECHNOLOGIES NIG LTD");

    // NIP transfer out: the wrapped 'NIP TRANSFER TO / PALMPAY - DAVID
    // OSAHON OGBEIDE' lines merged onto the 79,500.00 debit.
    expect(byRow.get(20)?.debitAmount).toBe(7_950_000);
    expect(byRow.get(20)?.balanceAfter).toBe(52177);
    expect(byRow.get(20)?.direction).toBe("out");
    expect(byRow.get(20)?.description).toContain("NIP TRANSFER TO");
    expect(byRow.get(20)?.description).toContain("PALMPAY - DAVID OSAHON OGBEIDE");

    // Value dates are preserved separately from the transaction date.
    expect(byRow.get(20)?.valueDate).toBe("2025-11-04");
    // The reference is a transient review aid ('GTW'-prefixed fragment).
    expect(byRow.get(20)?.reference).toBeDefined();

    // 50,000.00 credit with its long narration inside the branch cell.
    expect(byRow.get(27)?.creditAmount).toBe(5_000_000);
    expect(byRow.get(27)?.balanceAfter).toBe(5_046_802);
    expect(byRow.get(27)?.description).toContain("110023251104164054890135684255-MESSAGE-110023-");

    // 50.00 credit (Nov 19): reference present, narration merged above.
    expect(byRow.get(92)?.creditAmount).toBe(5_000);
    expect(byRow.get(92)?.balanceAfter).toBe(14_417);
    expect(byRow.get(92)?.reference).toBe("'100033251119103124");

    // The last two rows: 57.35 VAT and 4.30 VAT, closing balance 21.77.
    expect(byRow.get(101)?.debitAmount).toBe(5735);
    expect(byRow.get(101)?.balanceAfter).toBe(2607);
    expect(byRow.get(104)?.debitAmount).toBe(430);
    expect(byRow.get(104)?.balanceAfter).toBe(2177);

    // All 49 rows are from the FIRST account (SAVINGS): the page-4/5 blocks
    // (rows 105+) are never read.
    for (const tx of result.transactions) {
      expect(tx.row).toBeLessThan(105);
      expect(tx.transactionDate).toMatch(/^2025-11-\d{2}$/);
      expect(tx.currency).toBe("NGN");
      expect(tx.sourceBank).toBe("gtco");
    }
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
  });

  it("the full pipeline treats the REAL statement as supported GTCO (49 transactions)", () => {
    const preview = processStatement({
      cells: aligned,
      context: CONTEXT,
      categories: [],
      rowYs: alignedYs,
    });
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("gtco");
    expect(preview.transactions).toHaveLength(49);
    expect(preview.skipped).toBe(0);
    expect(preview.errors).toEqual([]);
    // The account-2/3 tables must never leak into the preview.
    for (const tx of preview.transactions ?? []) {
      expect(tx.row).toBeLessThan(105);
    }
  });
});