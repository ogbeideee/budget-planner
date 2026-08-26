import { describe, expect, it } from "vitest";

import { parseGtcoStatement } from "../gtcoParser";
import type { NormalizationContext } from "../statementTypes";

const HEADER = [
  "Trans. Date",
  "Value Date",
  "Reference",
  "Debits",
  "Credits",
  "Balance",
  "Originating Branch",
  "Remarks",
];

const CONTEXT: NormalizationContext = { currency: "NGN" };

function parse(...rows: (string | undefined)[][]) {
  return parseGtcoStatement(
    rows.map((row) => row.map((cell) => cell ?? "")),
    CONTEXT,
  );
}

function parseWithYs(rows: (string | undefined)[][], ys: (number | undefined)[]) {
  return parseGtcoStatement(
    rows.map((row) => row.map((cell) => cell ?? "")),
    CONTEXT,
    ys,
  );
}

describe("parseGtcoStatement", () => {
  it("parses a normal debit", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "13/08/2026", "GT-REF-0001", "500,000.00", "", "1,200,000.00", "VI 001", "RENT PAYMENT"],
    );
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    const tx = result.transactions[0];
    expect(tx.transactionDate).toBe("2026-08-12");
    expect(tx.valueDate).toBe("2026-08-13");
    expect(tx.reference).toBe("GT-REF-0001");
    expect(tx.debitAmount).toBe(50_000_000);
    expect(tx.creditAmount).toBeUndefined();
    expect(tx.balanceAfter).toBe(120_000_000);
    expect(tx.originatingBranch).toBe("VI 001");
    expect(tx.description).toBe("RENT PAYMENT");
    expect(tx.originalDescription).toBe("RENT PAYMENT");
    expect(tx.direction).toBe("out");
    expect(tx.currency).toBe("NGN");
    expect(tx.sourceBank).toBe("gtco");
    expect(tx.type).toBe("unknown");
    expect(tx.confidence).toBe("none");
    expect(tx.status).toBe("draft");
    expect(tx.categoryId).toBeNull();
    expect(tx.row).toBe(2);
  });

  it("parses a normal credit", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "13/08/2026", "GT-REF-0002", "", "1,000,000.00", "3,200,000.00", "VI 001", "SALARY"],
    );
    const tx = result.transactions[0];
    expect(tx.creditAmount).toBe(100_000_000);
    expect(tx.debitAmount).toBeUndefined();
    expect(tx.direction).toBe("in");
    expect(tx.balanceAfter).toBe(320_000_000);
  });

  it("preserves the NIP transfer narration", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "12/08/2026", "GT-NIP-7712", "50,000.00", "", "150,000.00", "VI 012", "NIP TRANSFER TO PALMPAY"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("NIP TRANSFER TO PALMPAY");
    expect(tx.originalDescription).toBe("NIP TRANSFER TO PALMPAY");
    expect(tx.debitAmount).toBe(5_000_000);
    expect(tx.direction).toBe("out");
    expect(tx.reference).toBe("GT-NIP-7712");
  });

  it("parses a transfer between customers", () => {
    const result = parse(
      HEADER,
      ["10/08/2026", "10/08/2026", "GT-TBC-5521", "250,000.00", "", "750,000.00", "OB 004", "TRANSFER BETWEEN CUSTOMERS"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("TRANSFER BETWEEN CUSTOMERS");
    expect(tx.debitAmount).toBe(25_000_000);
    expect(tx.originatingBranch).toBe("OB 004");
  });

  it("parses a commission charge", () => {
    const result = parse(
      HEADER,
      ["10/08/2026", "10/08/2026", "", "52.50", "", "749,947.50", "", "Commission on NIP Transfer CHARGES"],
    );
    const tx = result.transactions[0];
    expect(tx.debitAmount).toBe(5_250);
    expect(tx.direction).toBe("out");
  });

  it("parses a VAT charge", () => {
    const result = parse(
      HEADER,
      ["10/08/2026", "10/08/2026", "", "10.50", "", "749,937.00", "", "VAT CHARGES"],
    );
    expect(result.transactions[0].debitAmount).toBe(1_050);
  });

  it("parses an SMS alert charge", () => {
    const result = parse(
      HEADER,
      ["10/08/2026", "10/08/2026", "", "4.00", "", "749,933.00", "", "SMS ALERT CHARGE"],
    );
    expect(result.transactions[0].debitAmount).toBe(400);
  });

  it("parses capitalised interest as a credit", () => {
    const result = parse(
      HEADER,
      ["31/08/2026", "31/08/2026", "GT-INT-001", "", "12,345.67", "812,345.67", "", "INTEREST CAPITALISED"],
    );
    const tx = result.transactions[0];
    expect(tx.creditAmount).toBe(1_234_567);
    expect(tx.direction).toBe("in");
    expect(tx.description).toBe("INTEREST CAPITALISED");
  });

  it("handles Excel-style leading-dot decimal amounts", () => {
    const result = parse(
      HEADER,
      ["10/08/2026", "10/08/2026", "", ".20", "", "1,000.00", "", "NIP TRANSFER TO PALMPAY"],
      ["11/08/2026", "11/08/2026", "", "", ".75", "1,000.75", "", "INTEREST"],
    );
    expect(result.transactions[0].debitAmount).toBe(20);
    expect(result.transactions[1].creditAmount).toBe(75);
  });

  it("handles whole and comma-separated amounts", () => {
    const result = parse(
      HEADER,
      ["10/08/2026", "10/08/2026", "", "1000", "", "2000", "", "WHOLE"],
      ["11/08/2026", "11/08/2026", "", "1,000", "", "3,000", "", "COMMA"],
      ["12/08/2026", "12/08/2026", "", "1,500,000.00", "", "1,503,000.00", "", "COMMA DECIMAL"],
    );
    expect(result.transactions[0].debitAmount).toBe(100_000);
    expect(result.transactions[1].debitAmount).toBe(100_000);
    expect(result.transactions[2].debitAmount).toBe(150_000_000);
  });

  it("keeps an empty debit cell when a credit is present", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "12/08/2026", "GT-REF-0009", "", "500.00", "2,500.00", "", "DEPOSIT"],
    );
    const tx = result.transactions[0];
    expect(tx.debitAmount).toBeUndefined();
    expect(tx.creditAmount).toBe(50_000);
    expect(tx.direction).toBe("in");
  });

  it("extracts the transaction time when present", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 14:32", "13/08/2026", "GT-REF-0010", "500.00", "", "2,000.00", "", "RENT PAYMENT"],
    );
    const tx = result.transactions[0];
    expect(tx.transactionDate).toBe("2026-08-12");
    expect(tx.transactionTime).toBe("14:32");
  });

  it("skips a row with an invalid date and records the error", () => {
    const result = parse(
      HEADER,
      ["31/13/2026", "13/08/2026", "GT-REF-0011", "500.00", "", "2,000.00", "", "BAD DATE"],
      ["13/08/2026", "13/08/2026", "GT-REF-0012", "600.00", "", "1,400.00", "", "GOOD DATE"],
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].row).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([{ row: 2, reason: "invalid date" }]);
  });

  it("skips a row whose amount cell is unexpected text", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "12/08/2026", "", "not-a-number", "", "2,000.00", "", "GARBAGE"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([{ row: 2, reason: "unparseable amount" }]);
  });

  it("skips a dated row with no debit or credit", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "12/08/2026", "", "", "", "2,000.00", "", ""],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "missing debit and credit" }]);
  });

  it("silently ignores footer rows without a date or amount", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "12/08/2026", "", "500.00", "", "2,000.00", "", "RENT"],
      ["", "", "", "", "", "2,000.00", "", ""],
      ["", "", "", "", "", "", "", ""],
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("parses without a remarks column and keeps the reference out of the description", () => {
    const result = parse(
      ["Trans. Date", "Value Date", "Reference", "Debits", "Credits", "Balance", "Originating Branch"],
      ["12/08/2026", "13/08/2026", "GT-REF-0020", "500.00", "", "2,000.00", "VI 001"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("(no description)");
    expect(tx.reference).toBe("GT-REF-0020");
    expect(tx.originalDescription).toBeUndefined();
    expect(tx.originatingBranch).toBe("VI 001");
  });

  it("parses headerless files using canonical GTCO column positions", () => {
    const result = parse(
      ["12/08/2026", "13/08/2026", "GT-REF-0021", "500.00", "", "2,000.00", "VI 001", "RENT"],
    );
    const tx = result.transactions[0];
    expect(tx.row).toBe(1);
    expect(tx.transactionDate).toBe("2026-08-12");
    expect(tx.valueDate).toBe("2026-08-13");
    expect(tx.debitAmount).toBe(50_000);
    expect(tx.originatingBranch).toBe("VI 001");
    expect(tx.description).toBe("RENT");
  });

  it("handles missing debit and credit columns gracefully", () => {
    const result = parse(
      ["Trans. Date", "Value Date", "Remarks"],
      ["12/08/2026", "13/08/2026", "RENT PAYMENT"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([{ row: 2, reason: "missing debit and credit" }]);
  });

  it("tolerates title rows and extra columns when locating the header", () => {
    const result = parse(
      ["Account Statement", "", "", "", "", "", "", ""],
      ["S/N", "Trans. Date", "Value Date", "Reference", "Debits", "Credits", "Balance", "Branch", "Remarks"],
      ["1", "12/08/2026", "13/08/2026", "GT-REF-0030", "500.00", "", "2,000.00", "VI 001", "RENT"],
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].row).toBe(3);
    expect(result.transactions[0].id).toBe("gt-r3");
    expect(result.transactions[0].debitAmount).toBe(50_000);
    expect(result.transactions[0].description).toBe("RENT");
  });

  it("parses multiple rows independently", () => {
    const result = parse(
      HEADER,
      ["10/08/2026", "10/08/2026", "", "500.00", "", "2,000.00", "", "A"],
      ["11/08/2026", "11/08/2026", "", "250.00", "", "1,750.00", "", "B"],
      ["12/08/2026", "12/08/2026", "", "", "100.00", "1,850.00", "", "C"],
    );
    expect(result.transactions.map((tx) => tx.description)).toEqual(["A", "B", "C"]);
    expect(result.transactions.map((tx) => tx.direction)).toEqual(["out", "out", "in"]);
    expect(result.transactions.map((tx) => tx.id)).toEqual(["gt-r2", "gt-r3", "gt-r4"]);
  });

  it("returns no transactions for an empty statement (8A)", () => {
    const result = parse();
    expect(result.transactions).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);

    const blank = parse(["", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", ""]);
    expect(blank.transactions).toEqual([]);
    expect(blank.skipped).toBe(0);
    expect(blank.errors).toEqual([]);
  });

  it("handles very large amounts (billions) exactly (8A)", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "13/08/2026", "GT-BIG-1", "2,500,000,000.00", "", "3,000,000,000.00", "", "BUILDING PURCHASE"],
      ["13/08/2026", "14/08/2026", "GT-BIG-2", "", "9,999,999,999.99", "12,999,999,999.99", "", "FX GAIN"],
    );
    expect(result.errors).toEqual([]);
    expect(result.transactions[0].debitAmount).toBe(250_000_000_000);
    expect(result.transactions[0].balanceAfter).toBe(300_000_000_000);
    expect(result.transactions[1].creditAmount).toBe(999_999_999_999);
    expect(result.transactions[1].balanceAfter).toBe(1_299_999_999_999);
  });

  it("rejects a row carrying both a debit and a credit (left-shifted columns)", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "13/08/2026", "GT-REF-0100", "500.00", "2,000.00", "VI 001", "RENT"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "conflicting debit and credit" }]);
  });

  it("rejects a row whose reference cell parses as an amount (misaligned row)", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "13/08/2026", "1,000.00", "500.00", "", "2,000.00", "VI 001", "RENT"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "misaligned row" }]);
  });

  it("never turns a long numeric reference into a credit (misaligned grid)", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "13/08/2026", "GT-NIP-7712", "500.00", "2607010201000"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "unparseable amount" }]);
  });

  it("parses an aligned row whose reference is a long numeric string", () => {
    const result = parse(
      HEADER,
      ["12/08/2026", "13/08/2026", "2607010201000", "500.00", "", "2,000.00", "VI 001", "RENT"],
    );
    expect(result.transactions).toHaveLength(1);
    const tx = result.transactions[0];
    expect(tx.debitAmount).toBe(50_000);
    expect(tx.reference).toBe("2607010201000");
    expect(tx.creditAmount).toBeUndefined();
  });
});

describe("parseGtcoStatement — continuation fragments (GTCO-real)", () => {
  // The real PDF prints wrapped narrations on separate lines: a fragment row
  // has NO date/debit/credit/balance but carries narration text (the long
  // text overflows into Originating Branch). The engine merges those rows
  // into the nearest transaction by printed y (tie → the NEXT transaction).

  it("merges a fragment printed BELOW the row into the previous transaction", () => {
    const result = parseWithYs(
      [
        HEADER,
        ["01-Nov-2025", "01-Nov-2025", "'", ".20", "", "21.79", "INTL AIRPORT RD ISOLO", ""],
        // Nearer tx1 (y=90, gap 2) than tx2 (y=80, gap 8) → previous.
        ["", "", "", "", "", "", "PALMPAY - DAVID OSAHON OGBEIDE", ""],
        ["02-Nov-2025", "02-Nov-2025", "'GTW", "1,000.00", "", "21.79", "VI 012", "NIP TRANSFER"],
      ],
      [100, 90, 88, 80],
    );
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe(
      "INTL AIRPORT RD ISOLO PALMPAY - DAVID OSAHON OGBEIDE",
    );
    expect(result.transactions[1].description).toBe("NIP TRANSFER");
  });

  it("merges a fragment printed ABOVE the row into that row (nearest by y; tie → next)", () => {
    const result = parseWithYs(
      [
        HEADER,
        ["01-Nov-2025", "01-Nov-2025", "GTW-900", "5,000.00", "", "100,000.00", "VI 001", "INTEREST"],
        // Exactly between tx1 (y=90) and tx2 (y=80): equidistant → NEXT.
        ["", "", "", "", "", "", "TRANSFER BETWEEN CUSTOMERS", ""],
        ["02-Nov-2025", "02-Nov-2025", "GTW-901", "", "80,000.00", "8,002,177.00", "VI 001", ""],
        // Trailing fragment below the last row → previous transaction.
        ["", "", "", "", "", "", "BESTAF TECHNOLOGIES NIG LTD", ""],
      ],
      [100, 90, 85, 80, 76],
    );
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe("INTEREST");
    expect(result.transactions[1].description).toContain("TRANSFER BETWEEN CUSTOMERS");
    expect(result.transactions[1].creditAmount).toBe(8_000_000);
    expect(result.transactions[1].description).toContain("BESTAF TECHNOLOGIES NIG LTD");
  });

  it("without rowYs, fragments attach to the previous transaction (legacy behavior)", () => {
    const result = parse(
      HEADER,
      ["01-Nov-2025", "01-Nov-2025", "'", ".20", "", "21.79", "INTL AIRPORT RD ISOLO", ""],
      ["", "", "", "", "", "", "PALMPAY - DAVID OSAHON OGBEIDE", ""],
      ["02-Nov-2025", "02-Nov-2025", "'GTW", "1,000.00", "", "21.79", "VI 012", "NIP TRANSFER"],
    );
    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe(
      "INTL AIRPORT RD ISOLO PALMPAY - DAVID OSAHON OGBEIDE",
    );
    expect(result.transactions[1].description).toBe("NIP TRANSFER");
  });

  it("stops at the second account block (Statement Period boundary)", () => {
    // The account-2 block starts with the label/value pair — exactly as the
    // real PDF prints it: "Statement Period 01-Nov-2025-30-Nov-2025" on ONE
    // aligned row, followed by Branch/AccountNo/Reference/Type/Currency
    // pairs. The boundary must stop BEFORE any of them is read.
    const result = parse(
      HEADER,
      ["01-Nov-2025", "01-Nov-2025", "'", ".20", "", "21.79", "INTL AIRPORT RD ISOLO", ""],
      ["Statement Period", "01-Nov-2025-30-Nov-2025", "", "", "", "", "", ""],
      ["Branch Name", "INTL AIRPORT RD ISOLO", "", "", "", "", "", ""],
      ["Account No.", "081XXXX044", "", "", "", "", "", ""],
      ["Internal Reference", "R03XXXX625", "", "", "", "", "", ""],
      ["Account Type", "GTTARGET", "", "", "", "", "", ""],
      ["Currency", "NIGERIAN NAIRA", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "CUSTOMER STATEMENT"],
      ["Opening Balance", ".16", "", "", "", "", "", ""],
      HEADER,
      ["05-Nov-2025", "05-Nov-2025", "GTW-999", "", "50,000.00", "500,000.00", "VI 001", "SALARY"],
    );
    // The page-4/5 account blocks must never be read into the first account.
    expect(result.transactions).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.transactions[0].description).toBe("INTL AIRPORT RD ISOLO");
  });

  it("stops at a second account's CUSTOMER STATEMENT header", () => {
    const result = parse(
      HEADER,
      ["01-Nov-2025", "01-Nov-2025", "'", ".20", "", "21.79", "INTL AIRPORT RD ISOLO", ""],
      ["", "", "", "", "", "", "", "CUSTOMER STATEMENT"],
      HEADER,
      ["05-Nov-2025", "05-Nov-2025", "GTW-999", "", "50,000.00", "500,000.00", "VI 001", "SALARY"],
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.transactions[0].row).toBe(2);
  });

  it("skips a repeated columnar header without an error", () => {
    const result = parse(
      HEADER,
      ["01-Nov-2025", "01-Nov-2025", "'", ".20", "", "21.79", "INTL AIRPORT RD ISOLO", ""],
      HEADER,
      ["02-Nov-2025", "02-Nov-2025", "'GTW", "1,000.00", "", "21.79", "VI 012", "NIP TRANSFER"],
    );
    expect(result.transactions).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.transactions[1].description).toBe("NIP TRANSFER");
  });

  it("keeps the branch cell out of the description when there is no Remarks column", () => {
    const noRemarks = [
      "Trans. Date",
      "Value Date",
      "Reference",
      "Debits",
      "Credits",
      "Balance",
      "Originating Branch",
    ];
    const result = parse(
      noRemarks,
      ["12/08/2026", "13/08/2026", "GT-REF-0020", "500.00", "", "2,000.00", "VI 001"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("(no description)");
    expect(tx.originatingBranch).toBe("VI 001");
  });
});
