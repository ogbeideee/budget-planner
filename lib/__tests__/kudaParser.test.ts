// Kuda statement parser tests (Prompt 8E).
//
// Covers the TWO statement forms both reaching the SAME parser:
//   - text-based PDFs → clean column-split cells,
//   - scanned PDFs → OCR cells (one line per cell, single spaces).
// The layouts are modelled on the REAL Kuda statement (the scanned fixture's
// OCR ground truth, tests/fixtures/statements/Kuda/kuda.ocr.txt, and the
// 8C manifest layout facts) — including wrapped descriptions, the dd/mm/yy
// dates, the "#"-read naira sign and the per-account sections.

import { describe, expect, it } from "vitest";

import {
  parseAmountCell,
  parseStatementDate,
  parseStatementDateTime,
} from "../statementImport";
import {
  kudaHeaderScore,
  parseKudaStatement,
  type KudaParseResult,
} from "../kudaParser";
import { detectStatementFormat, processStatement } from "../statementPipeline";
import type { NormalizationContext } from "../statementTypes";
import type { Category } from "../types";

const CONTEXT: NormalizationContext = { currency: "NGN" };

// ---------------------------------------------------------------------------
// Shared helpers the Kuda format needs (2-digit years, "#"-naira amounts).
// ---------------------------------------------------------------------------

describe("shared helpers — Kuda date/amount forms", () => {
  it("parses dd/mm/yy (2-digit year, day-first for NGN)", () => {
    expect(parseStatementDate("01/08/26")).toBe("2026-08-01");
    expect(parseStatementDate("12/08/26")).toBe("2026-08-12");
    expect(parseStatementDate("31/12/26")).toBe("2026-12-31");
    expect(parseStatementDate("99/99/26")).toBeNull();
    expect(parseStatementDate("31/02/26")).toBeNull();
  });

  it("parses dd/mm/yy with a time suffix", () => {
    expect(parseStatementDateTime("01/08/26 13:05:08")).toEqual({
      date: "2026-08-01",
      time: "13:05:08",
    });
    expect(parseStatementDateTime("01/08/26 4:20 PM")).toEqual({
      date: "2026-08-01",
      time: "16:20",
    });
  });

  it("parses the OCR-read naira sign '#' like ₦", () => {
    expect(parseAmountCell("#100.00")).toEqual({
      minor: 10_000,
      direction: "unknown",
    });
    expect(parseAmountCell("#30.00")).toEqual({
      minor: 3_000,
      direction: "unknown",
    });
  });

  it("never parses '--' or bare 10-digit runs as amounts", () => {
    expect(parseAmountCell("--")).toBeNull();
    expect(parseAmountCell("3000127755")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Format detection.
// ---------------------------------------------------------------------------

const KUDA_TABLE_HEADER = [
  "Date/Time",
  "Money In",
  "Money Out",
  "Category",
  "To/From",
  "Description",
  "Balance",
];

describe("kudaHeaderScore", () => {
  it("scores the real table header above the viability threshold", () => {
    expect(kudaHeaderScore(KUDA_TABLE_HEADER)).toBeGreaterThanOrEqual(5);
  });

  it("scores the ONE-CELL-per-line OCR form too (no column gaps)", () => {
    expect(
      kudaHeaderScore([
        "Date/Time Money In Money Out Category To/From Description Balance",
      ]),
    ).toBeGreaterThanOrEqual(5);
    expect(
      kudaHeaderScore(["Money In Money Out Opening Balance Closing Balance"]),
    ).toBeGreaterThanOrEqual(5);
    expect(kudaHeaderScore(["Opening Balance Closing Balance"])).toBeGreaterThanOrEqual(5);
  });

  it("scores Kuda section labels", () => {
    expect(kudaHeaderScore(["Spend Account", "14.33", "29.33"])).toBeGreaterThanOrEqual(2);
    expect(kudaHeaderScore(["Spend + Save (1 Pocket)", "#30.00", "840.00"])).toBeGreaterThanOrEqual(2);
    expect(kudaHeaderScore(["Summary"])).toBe(1);
    expect(kudaHeaderScore(["Type", "Opening Balance", "Closing Balance"])).toBeGreaterThanOrEqual(5);
  });

  it("never scores generic words like 'transfer' or 'statement'", () => {
    expect(kudaHeaderScore(["Date", "Description", "Amount", "Balance"])).toBeLessThan(5);
    expect(
      kudaHeaderScore(["Account Statement", "Transfer", "Transfer to JOHN DOE"]),
    ).toBe(0);
  });

  it("stays below the threshold for the other banks' headers", () => {
    // GTCO
    expect(
      kudaHeaderScore([
        "Trans. Date",
        "Value Date",
        "Reference",
        "Debits",
        "Credits",
        "Balance",
        "Originating Branch",
        "Remarks",
      ]),
    ).toBeLessThan(5);
    // OPay
    expect(
      kudaHeaderScore([
        "Trans. Time",
        "Value Date",
        "Description",
        "Debit(₦)",
        "Credit(₦)",
        "Balance After(₦)",
        "Channel",
        "Transaction Reference",
      ]),
    ).toBeLessThan(5);
    // PalmPay (its "Money In (NGN)" contributes only 4)
    expect(
      kudaHeaderScore([
        "Transaction Date",
        "Transaction Detail",
        "Money In (NGN)",
        "Money Out (NGN)",
        "Transaction ID",
      ]),
    ).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// Statement cells used by the parse tests — the REAL Kuda layout (8C/8E),
// text-layer form (one row per visual line, columns split into cells).
// ---------------------------------------------------------------------------

const TEXT_BASED_GRID: string[][] = [
  ["Account Number", "Date"],
  ["DAVID OSAHON OGBEIDE", "2003640955", "01/07/2026 - 14/08/2026"],
  ["2 OLABISI STREET, IKOSI KETU, KOSOFE, LAGOS, 105102, NIGERIA"],
  ["Opening Balance", "Closing Balance"],
  ["44.33", "69.33"],
  ["Summary"],
  ["Type", "Opening Balance", "Closing Balance"],
  ["Spend Account", "14.33", "29.33"],
  ["Spend + Save (1 Pocket)", "#30.00", "840.00"],
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

describe("detectStatementFormat — Kuda", () => {
  it("detects the text-based statement with high confidence", () => {
    const detection = detectStatementFormat(TEXT_BASED_GRID);
    expect(detection.bank).toBe("kuda");
    expect(detection.confidence).toBe("high");
  });

  it("detects the ONE-CELL-per-line OCR form (the 8D defect: no column gaps)", () => {
    const ocrCells = TEXT_BASED_GRID.map((row) => [row.join(" ")]);
    const detection = detectStatementFormat(ocrCells);
    expect(detection.bank).toBe("kuda");
    expect(detection.confidence).toBe("high");
  });

  it("never detects a transfer-heavy random statement as Kuda", () => {
    const cells = [
      ["Date", "Description", "Amount"],
      ["12/08/2026", "Transfer to JOHN DOE", "500.00"],
      ["13/08/2026", "TRANSFER", "250.00"],
      ["Account Statement", "Transfer", "1,000.00"],
    ];
    const detection = detectStatementFormat(cells);
    expect(detection.bank).toBe("unknown");
    expect(detection.reason).toBe("no bank header vocabulary found");
  });

  it("never detects 'Opening Balance / Closing Balance' alone without Kuda anchors", () => {
    // "opening balance"/"closing balance" give 6 points — but below 8 the
    // row must still BE those words; a bare-balance statement stays unknown.
    const cells = [
      ["Opening Balance", "Closing Balance"],
      ["44.33", "69.33"],
      ["Date", "Description", "Amount"],
      ["12/08/2026", "RENT PAYMENT", "500.00"],
    ];
    const detection = detectStatementFormat(cells);
    expect(detection.bank).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Parsing.
// ---------------------------------------------------------------------------

function parse(cells: string[][]): KudaParseResult {
  return parseKudaStatement(cells, CONTEXT);
}

describe("parseKudaStatement — text-based statement (wrapped rows)", () => {
  const result = parse(TEXT_BASED_GRID);

  it("parses all 5 real transactions, nothing else", () => {
    expect(result.transactions).toHaveLength(5);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.transactions.map((tx) => tx.row)).toEqual([14, 16, 18, 20, 26]);
  });

  it("money in: amount, balance, direction from the running-balance delta", () => {
    const [tx1] = result.transactions;
    expect(tx1.transactionDate).toBe("2026-08-01");
    expect(tx1.transactionTime).toBe("13:05:08");
    expect(tx1.creditAmount).toBe(292_500);
    expect(tx1.debitAmount).toBeUndefined();
    expect(tx1.balanceAfter).toBe(293_933);
    expect(tx1.direction).toBe("in");
    expect(tx1.sourceBank).toBe("kuda");
    expect(tx1.categoryId).toBeNull();
  });

  it("money out: wrapped description merged from the time line", () => {
    const tx2 = result.transactions[1];
    expect(tx2.transactionDate).toBe("2026-08-02");
    expect(tx2.transactionTime).toBe("21:39:58");
    expect(tx2.debitAmount).toBe(280_000);
    expect(tx2.creditAmount).toBeUndefined();
    expect(tx2.balanceAfter).toBe(13_933);
    expect(tx2.direction).toBe("out");
    expect(tx2.description).toContain("outward transfer");
    expect(tx2.description).toContain("David Osahon Ogbeide");
    expect(tx2.description).toContain("Ogbeide/0242986234/Wema Bank");
    expect(tx2.originalDescription).toBe(tx2.description);
  });

  it("fees: category tag decides direction when the balance chain mismatches", () => {
    const tx3 = result.transactions[2];
    expect(tx3.debitAmount).toBe(10_000);
    expect(tx3.balanceAfter).toBe(83_933);
    expect(tx3.direction).toBe("out");
    expect(tx3.description).toContain("outward transfer");
  });

  it("a second section resets the balance chain and still parses", () => {
    const tx5 = result.transactions[4];
    expect(tx5.transactionDate).toBe("2026-08-04");
    expect(tx5.transactionTime).toBe("16:53:03");
    expect(tx5.debitAmount).toBe(1_000);
    expect(tx5.creditAmount).toBeUndefined();
    expect(tx5.balanceAfter).toBe(84_000);
    expect(tx5.direction).toBe("out");
    expect(tx5.description).toContain("Spend + Save");
  });

  it("summary rows, totals rows and page footers never become transactions", () => {
    for (const tx of result.transactions) {
      expect(tx.description).not.toMatch(/^Summary$/);
      expect(tx.description).not.toMatch(/^Page /);
    }
  });

  it("never mistakes the '/'-separated narration strings for amounts", () => {
    const [tx1] = result.transactions;
    expect(tx1.description).toContain("Disbursment/3000127755/Kuda sportybet");
    expect(tx1.debitAmount).toBeUndefined();
    expect(tx1.creditAmount).toBe(292_500);
  });
});

describe("parseKudaStatement — OCR form (one cell per line)", () => {
  const OCR_GRID = [
    ["Account Number Date"],
    ["Cea) ee, eines) Pee 2003640955 01/07/2026 - 14/08/2026"],
    ["2 OLABISI STREET, . ."],
    ["Opening Balance Closing Balance"],
    ["IKOSI KETU, KOSOFE, LAGOS, 105102,"],
    ["NIGERIA IKOSI KETU, KOSOFE, LAGOS 44.33 69.33"],
    ["Summary"],
    ["Type Opening Balance Closing Balance"],
    ["Spend Account 14.33 29.33"],
    ["Spend + Save (1 Pocket) #30.00 840.00"],
    ["Spend Account"],
    ["Money In Money Out Opening Balance Closing Balance"],
    ["2,925.00 2,910.00 14.33 29.33"],
    ["Date/Time Money In Money Out Category To/From Description Balance"],
    ["01/08/26 2,925.00 local funds Sporty Internet Ltd - from 2,939.33"],
    ["13:05:08 transfer Disbursment/3000127755/Kuda sportybet"],
    ["02/08/26 2,800.00 outward David Osahon mine 139.33"],
    ["21:39:58 transfer Ogbeide/0242986234/Wema Bank"],
    ["04/08/26 #100.00 outward David Osahon nnn 839.33"],
    ["16:53:03 transfer Ogbeide/8082389369/Opay Digital Services Limited"],
    ["04/08/26 #10.00 spend and spend and 29.33"],
    ["16:53:03 save save"],
    ["Spend + Save"],
    ["Money In Money Out Opening Balance Closing Balance"],
    ["10.00 830.00 640.00"],
    ["Date/Time Money In Money Out To Description Balance"],
    ["04/08/26 #10.00 Spend + Save ogbeide david- spend 840.00"],
    ["16:53:03 and save"],
    ["cea"],
    ["LN"],
    ["_ Sn"],
    ["Nai s"],
    ["i Re"],
    ["Page 1 of 2"],
    ["NOES,"],
    ["ge"],
    ["gi '3"],
    ["A BM"],
    ["4)"],
    ["pe"],
    ["Page 2 of 2"],
  ];

  const result = parse(OCR_GRID);

  it("parses the same 5 real transactions as the text-based form", () => {
    expect(result.transactions).toHaveLength(5);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("reads the real money-in row (local funds transfer)", () => {
    const tx1 = result.transactions[0];
    expect(tx1.transactionDate).toBe("2026-08-01");
    expect(tx1.transactionTime).toBe("13:05:08");
    expect(tx1.creditAmount).toBe(292_500);
    expect(tx1.balanceAfter).toBe(293_933);
    expect(tx1.direction).toBe("in");
    expect(tx1.description).toContain("local funds");
    expect(tx1.description).toContain("sportybet");
  });

  it("reads the OCR '#100.00' amount and survives the mangled balance", () => {
    const tx3 = result.transactions[2];
    expect(tx3.debitAmount).toBe(10_000);
    expect(tx3.direction).toBe("out");
    expect(tx3.description).toContain("outward");
  });

  it("the Spend + Save section parses from its own (Category-less) table", () => {
    const tx5 = result.transactions[4];
    expect(tx5.debitAmount).toBe(1_000);
    expect(tx5.direction).toBe("out");
    expect(tx5.description).toContain("Spend + Save");
    expect(tx5.description).toContain("ogbeide david-");
    expect(tx5.description).toContain("and save");
  });

  it("never merges page-footer OCR junk into a description", () => {
    const tx5 = result.transactions[4];
    for (const junk of ["cea", "LN", "Nai", "NOES"]) {
      expect(tx5.description.toLowerCase()).not.toContain(junk);
    }
  });
});

describe("parseKudaStatement — wrapped descriptions (3+ visual lines)", () => {
  it("merges a long description that wraps over the time line", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["05/08/26", "", "100.00", "merchant payment", "ShopRite", "Weekly groceries and household items purchased", "39.33"],
      ["09:15:33", "and paid", "for online"],
    ];
    const result = parse(cells);
    expect(result.transactions).toHaveLength(1);
    const [tx] = result.transactions;
    expect(tx.debitAmount).toBe(10_000);
    expect(tx.balanceAfter).toBe(3_933);
    expect(tx.direction).toBe("out");
    expect(tx.description).toContain(
      "Weekly groceries and household items purchased and paid for online",
    );
  });

  it("merges a text-only wrap when the block has no time line", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["06/08/26", "", "50.00", "outward transfer", "Dstv", "Payment for subscription", "2,889.33"],
      ["bundle renewal"],
    ];
    const result = parse(cells);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toContain(
      "Payment for subscription bundle renewal",
    );
  });
});

describe("parseKudaStatement — error handling", () => {
  it("empty statement: zero transactions, zero errors", () => {
    expect(parse([])).toEqual({ transactions: [], skipped: 0, errors: [] });
    expect(parse([[""], ["  "]])).toEqual({
      transactions: [],
      skipped: 0,
      errors: [],
    });
  });

  it("unreadable statement (no dates at all): zero transactions", () => {
    const result = parse([
      ["NOES,"],
      ["ge"],
      ["gi '3"],
      ["Page 2 of 2"],
    ]);
    expect(result.transactions).toEqual([]);
    expect(result.skipped).toBe(0);
  });

  it("a dated row with no amounts is skipped and reported", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["01/08/26", "local funds transfer", "Sporty Internet Ltd", "- from"],
      ["02/08/26", "", "2,800.00", "outward transfer", "David Osahon Ogbeide", "Ogbeide/0242986234/Wema Bank", "139.33"],
    ];
    const result = parse(cells);
    expect(result.transactions).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([
      { row: 2, reason: "missing debit and credit" },
    ]);
  });

  it("a row whose direction can't be resolved is emitted unresolved, never guessed", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["01/08/26", "0.70", "garbled noise"],
    ];
    const result = parse(cells);
    // No longer skipped: the row reaches review flagged for the user.
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      direction: "unknown",
      type: "unknown",
      unresolvedAmount: 70,
      transactionDate: "2026-08-01",
    });
    // Neither side is claimed — a guessed side would silently pre-fill
    // expense or income.
    expect(result.transactions[0].debitAmount).toBeUndefined();
    expect(result.transactions[0].creditAmount).toBeUndefined();
  });

  it("one bad row never kills the good rows around it", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["01/08/26", "", "100.00", "outward transfer", "A", "one", "139.33"],
      ["02/08/26", "garbled"],
      ["03/08/26", "", "50.00", "outward transfer", "B", "two", "89.33"],
    ];
    const result = parse(cells);
    expect(result.transactions).toHaveLength(2);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([
      { row: 3, reason: "missing debit and credit" },
    ]);
  });
});

describe("parseKudaStatement — direction is never guessed from 'Transfer'", () => {
  it("a bare 'transfer' narration without a category tag stays unresolved", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["01/08/26", "", "500.00", "Transfer to JOHN DOE", "999.33"],
    ];
    const result = parse(cells);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].direction).toBe("unknown");
    expect(result.transactions[0].type).toBe("unknown");
    expect(result.transactions[0].unresolvedAmount).toBe(50_000);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("balance delta outranks any tag", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["01/08/26", "2,925.00", "local funds transfer", "Sporty Internet Ltd", "Disbursment/3000127755/Kuda sportybet", "2,939.33"],
      ["02/08/26", "", "2,800.00", "outward transfer", "David Osahon Ogbeide", "Ogbeide/0242986234/Wema Bank", "139.33"],
    ];
    const result = parse(cells);
    expect(result.transactions[0].direction).toBe("in");
    expect(result.transactions[1].direction).toBe("out");
  });
});

describe("processStatement — Kuda end to end", () => {
  const CATEGORIES: Category[] = [];
  const preview = processStatement({
    cells: TEXT_BASED_GRID,
    context: CONTEXT,
    categories: CATEGORIES,
  });

  it("is supported and classified like any other bank", () => {
    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("kuda");
    expect(preview.detectedLabel).toBe("Kuda");
    expect(preview.transactions).toHaveLength(5);
    expect(preview.skipped).toBe(0);
    // Kuda labels are structural: transfers and Spend + Save pockets get a
    // deterministic kind + transaction type instead of staying unknown.
    expect(preview.transactions.map((tx) => tx.type)).toEqual([
      "transfer",
      "transfer",
      "transfer",
      "savings",
      "savings",
    ]);
    expect(preview.transactions.map((tx) => tx.txType)).toEqual([
      "transfer",
      "transfer",
      "transfer",
      "savings",
      "savings",
    ]);
    for (const tx of preview.transactions) {
      expect(tx.categoryId).toBeNull();
    }
  });

  it("an unresolved-direction row reaches review flagged — never booked by default", () => {
    const cells = [
      ["Date/Time", "Money In", "Money Out", "Category", "To/From", "Description", "Balance"],
      ["01/08/26", "0.70", "garbled noise"],
    ];
    const result = processStatement({ cells, context: CONTEXT, categories: CATEGORIES });
    expect(result.status).toBe("supported");
    expect(result.transactions).toHaveLength(1);
    const tx = result.transactions[0];
    // The pipeline's type pre-fill leaves an unresolved direction "unknown";
    // classification flags the row for the user instead of guessing.
    expect(tx.direction).toBe("unknown");
    expect(tx.type).toBe("unknown");
    expect(tx.unresolvedAmount).toBe(70);
    expect(tx.needsReview).toBe(true);
  });
});
