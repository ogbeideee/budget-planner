// PalmPay statement parser tests (Prompt 8J).
//
// PalmPay exports a text-layer PDF: the pdfjs text layer lands in
// lib/statementImport.ts groupPdfLines as a column-split cell grid (top-down
// reading order since 8J), so the parser is tested on that grid shape —
// synthetic layouts modelled on the REAL statement, plus the certified real
// fixture (tests/fixtures/statements/Palmpay/, 75 rows, printed totals
// ₦183,800.71 in / ₦340,270.00 out) through the exact runtime path
// (fixtureCells = groupPdfLines over the real snapshot).

import { describe, expect, it } from "vitest";

import { parseStatementDate, parseStatementDateTime } from "../statementImport";
import {
  MAX_PALMPAY_REFERENCE_LENGTH,
  palmpayHeaderScore,
  parsePalmPayStatement,
} from "../palmpayParser";
import { detectStatementFormat } from "../statementPipeline";
import type { NormalizationContext } from "../statementTypes";
import { fixtureCells, fixtureRowYs } from "../../tests/fixtures/statements/manifest";

const CONTEXT: NormalizationContext = { currency: "NGN" };

const PALMPAY_HEADER = [
  "Transaction Date",
  "Transaction Detail",
  "Money In (NGN)",
  "Money Out (NGN)",
  "Transaction ID",
];

// ---------------------------------------------------------------------------
// Shared helpers — PalmPay's US-ordered dates and signed amounts.
// ---------------------------------------------------------------------------

describe("shared helpers — PalmPay's month-first dates", () => {
  it("reads ambiguous MM/DD/YYYY as month-first, not the NGN day-first norm", () => {
    expect(parseStatementDate("08/09/2026", "month-day")).toBe("2026-08-09");
    expect(parseStatementDate("08/09/2026")).toBe("2026-09-08");
    expect(parseStatementDate("08/15/2026", "month-day")).toBe("2026-08-15");
    expect(parseStatementDate("12/31/2026", "month-day")).toBe("2026-12-31");
    expect(parseStatementDate("31/08/2026", "month-day")).toBe("2026-08-31");
  });

  it("parses the AM/PM datetime cells with a month-first order", () => {
    expect(parseStatementDateTime("08/15/2026 06:05:46 AM", "month-day")).toEqual({
      date: "2026-08-15",
      time: "06:05:46",
    });
    expect(parseStatementDateTime("08/12/2026 08:18:25 PM", "month-day")).toEqual({
      date: "2026-08-12",
      time: "20:18:25",
    });
  });
});

describe("palmpayHeaderScore", () => {
  it("scores the real 5-column table header 11 (3+2+2+2+2)", () => {
    expect(palmpayHeaderScore(PALMPAY_HEADER)).toBe(11);
    // Currency markers never add vocabulary.
    expect(palmpayHeaderScore(["Transaction Date", "Transaction Detail", "Money In (NGN)"])).toBe(7);
  });

  it("a generic 'Transaction Date + Transaction Detail + Amount' export stays below the registry min (6)", () => {
    expect(
      palmpayHeaderScore(["Transaction Date", "Transaction Detail", "Amount"]),
    ).toBe(5);
  });

  it("blank and account-block cells contribute nothing", () => {
    expect(palmpayHeaderScore([])).toBe(0);
    expect(palmpayHeaderScore(["Account Statement", "Total Money In: ₦183,800.71"])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Synthetic layouts (modelled on the real statement).
// ---------------------------------------------------------------------------

describe("parsePalmPayStatement — synthetic layouts", () => {
  it("parses a plain page: account block + header + single-line rows", () => {
    const cells = [
      ["Name", "Account Statement"],
      ["Account Number: 8010510140", ""],
      ["Total Money In: ₦183,800.71", ""],
      ["Total Money Out: ₦340,270.00", ""],
      PALMPAY_HEADER,
      ["08/15/2026 06:05:46 AM", "CashBox Interest", "+0.14", "u8397q88ef2a"],
      ["08/12/2026 08:18:25 PM", "Send to FRIDAY PATIENCE NISMA", "-40000.00", "03392cdb1501"],
      ["08/09/2026 07:20:06 PM", "Received from DAVID OSAHON OGBEIDE", "+120000.00", "6038xn04ab06"],
    ];
    const result = parsePalmPayStatement(cells, CONTEXT);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(3);

    const [interest, send, receive] = result.transactions;
    expect(interest).toMatchObject({
      transactionDate: "2026-08-15",
      transactionTime: "06:05:46",
      description: "CashBox Interest",
      reference: "u8397q88ef2a",
      creditAmount: 14,
      debitAmount: undefined,
      direction: "in",
      sourceBank: "palmpay",
      currency: "NGN",
    });
    expect(send).toMatchObject({
      transactionDate: "2026-08-12",
      description: "Send to FRIDAY PATIENCE NISMA",
      reference: "03392cdb1501",
      debitAmount: 4_000_000,
      direction: "out",
    });
    // "08/09/2026" is 9 August — the month-first order (day-first would be
    // 8 September).
    expect(receive.transactionDate).toBe("2026-08-09");
    expect(receive.creditAmount).toBe(12_000_000);
    expect(receive.direction).toBe("in");
  });

  it("joins wrapped Detail and ID continuation lines in reading order", () => {
    // A wrapped stamp-duty row: the date line then a continuation line with
    // the wrapped Transaction ID; and a wrapped Detail row below.
    const cells = [
      PALMPAY_HEADER,
      ["08/09/2026 07:20:39 PM", "Stamp Duty", "-5.00", "20260809114820399392"],
      ["0649447", ""],
      ["08/09/2026 07:20:06 PM", "Received from DAVID", "+120000.00", "6038xn04ab06"],
      ["OSAHON OGBEIDE", ""],
    ];
    const result = parsePalmPayStatement(cells, CONTEXT);
    expect(result.skipped).toBe(0);
    expect(result.transactions).toHaveLength(2);

    expect(result.transactions[0]).toMatchObject({
      description: "Stamp Duty",
      reference: "20260809114820399392 0649447",
      debitAmount: 500,
      direction: "out",
    });
    expect(result.transactions[1]).toMatchObject({
      description: "Received from DAVID OSAHON OGBEIDE",
      reference: "6038xn04ab06",
      creditAmount: 12_000_000,
    });
  });

  it("never reads the account block, the header or page-number footers as transactions", () => {
    const cells = [
      ["Name", "Account Statement"],
      ["Account Number: 8010510140", ""],
      ["Total Money In: ₦183,800.71", ""],
      ["Total Money Out: ₦340,270.00", ""],
      PALMPAY_HEADER,
      ["08/15/2026 06:05:46 AM", "CashBox Interest", "+0.14", "u8397q88ef2a"],
      ["1", ""],
      ["08/14/2026 07:00:00 PM", "Data Purchase", "-1000.00", "at_38koe31701"],
      ["3", ""],
    ];
    const result = parsePalmPayStatement(cells, CONTEXT);
    expect(result.transactions).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("caps the Transaction ID at the reference max (review aid only)", () => {
    const longId = "x".repeat(200);
    const cells = [
      PALMPAY_HEADER,
      ["08/15/2026 06:05:46 AM", "CashBox Interest", "+0.14", longId],
    ];
    const result = parsePalmPayStatement(cells, CONTEXT);
    expect(result.transactions[0].reference?.length).toBe(MAX_PALMPAY_REFERENCE_LENGTH);
  });

  it("honours optional-field honesty: no balance, value date or category is invented", () => {
    const cells = [
      PALMPAY_HEADER,
      ["08/15/2026 06:05:46 AM", "CashBox Interest", "+0.14", "u8397q88ef2a"],
    ];
    const [tx] = parsePalmPayStatement(cells, CONTEXT).transactions;
    expect(tx.balanceAfter).toBeUndefined();
    expect(tx.valueDate).toBeUndefined();
    expect(tx.categoryId).toBeNull();
  });

  it("reports rows with no signed amount as skipped, never silent", () => {
    const cells = [
      PALMPAY_HEADER,
      ["08/15/2026 06:05:46 AM", "CashBox Interest", "", "u8397q88ef2a"],
    ];
    const result = parsePalmPayStatement(cells, CONTEXT);
    expect(result.transactions).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.errors[0].reason).toBe("missing debit and credit");
  });
});

// ---------------------------------------------------------------------------
// The REAL certified statement (75 rows; ₦183,800.71 in / ₦340,270.00 out).
// ---------------------------------------------------------------------------

describe("parsePalmPayStatement — the real certified statement", () => {
  it("detects as PalmPay and never as GTCO, OPay or Kuda", () => {
    const detection = detectStatementFormat(fixtureCells("palmpay"));
    expect(detection.bank).toBe("palmpay");
  });

  it("parses all 75 rows, nothing skipped and no errors", () => {
    const result = parsePalmPayStatement(fixtureCells("palmpay"), CONTEXT, fixtureRowYs("palmpay"));
    expect(result.transactions).toHaveLength(75);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(new Set(result.transactions.map((tx) => tx.id)).size).toBe(75);
  });

  it("sums exactly match the statement's own printed totals (minor units)", () => {
    const result = parsePalmPayStatement(fixtureCells("palmpay"), CONTEXT, fixtureRowYs("palmpay"));
    const totalIn = result.transactions.reduce((sum, tx) => sum + (tx.creditAmount ?? 0), 0);
    const totalOut = result.transactions.reduce((sum, tx) => sum + (tx.debitAmount ?? 0), 0);
    expect(totalIn).toBe(18_380_071);
    expect(totalOut).toBe(34_027_000);
  });

  it("reads rows in reading order: newest on top (page 1 top) to oldest at the bottom", () => {
    const result = parsePalmPayStatement(fixtureCells("palmpay"), CONTEXT, fixtureRowYs("palmpay"));
    expect(result.transactions[0].transactionDate).toBe("2026-08-15");
    expect(result.transactions[0].description).toBe("CashBox Interest");
    expect(result.transactions[74].transactionDate).toBe("2026-07-15");
  });

  it("merges the real wrapped rows (Prompt 8C lens rows, verbatim)", () => {
    const result = parsePalmPayStatement(fixtureCells("palmpay"), CONTEXT, fixtureRowYs("palmpay"));

    const send = result.transactions.find((tx) => tx.reference === "03392cdb1501");
    expect(send?.description).toBe("Send to FRIDAY PATIENCE NISMA");
    expect(send?.debitAmount).toBe(40_000);
    expect(send?.transactionDate).toBe("2026-08-12");

    const receive = result.transactions.find((tx) => tx.reference === "6038xn04ab06");
    expect(receive?.description).toBe("Received from DAVID OSAHON OGBEIDE");
    expect(receive?.creditAmount).toBe(120_000);
    expect(receive?.transactionDate).toBe("2026-08-09");

    const disbursement = result.transactions.find(
      (tx) => tx.description === "Disbursement-Installment loan",
    );
    expect(disbursement?.creditAmount).toBe(3_500_000);

    // The stamp-duty reference wraps across two printed lines — the id joins
    // with a space and the row is still one transaction.
    const stampDuty = result.transactions.filter(
      (tx) => tx.reference === "20260809114820399392 0649447",
    );
    expect(stampDuty).toHaveLength(1);
    expect(stampDuty[0].description).toBe("Stamp Duty");
    expect(stampDuty[0].debitAmount).toBe(5_000);
  });

  it("reads ambiguous dates month-first and never invents balance/value-date/account fields", () => {
    const result = parsePalmPayStatement(fixtureCells("palmpay"), CONTEXT, fixtureRowYs("palmpay"));
    for (const tx of result.transactions) {
      expect(tx.transactionDate).toBeDefined();
      expect(tx.balanceAfter).toBeUndefined();
      expect(tx.valueDate).toBeUndefined();
      expect(tx.categoryId).toBeNull();
    }
    // "08/09/2026 07:20:06 PM" is 9 August — the month-first read (day-first
    // would have turned it into 8 September).
    const receive = result.transactions.find((tx) => tx.reference === "6038xn04ab06");
    expect(receive?.transactionDate).toBe("2026-08-09");
  });
});
