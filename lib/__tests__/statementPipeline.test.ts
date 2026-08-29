import { describe, expect, it } from "vitest";

import {
  detectStatementFormat,
  ledgerKindFor,
  planImport,
  prefillLedgerKindFor,
  processStatement,
} from "../statementPipeline";
import type { ImportRow } from "../statementPipeline";
import { BANK_PARSERS } from "../statementRegistry";
import type {
  BankDirection,
  BankSource,
  BankStatementParser,
  NormalizedBankTransaction,
} from "../statementTypes";
import type { Category } from "../types";

const CATEGORIES: Category[] = [
  { id: "c-rent", name: "Rent", icon: "🏠", color: "#ef4444", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-groceries", name: "Groceries", icon: "🛒", color: "#f97316", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-transport", name: "Transport", icon: "🚌", color: "#eab308", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-utilities", name: "Utilities", icon: "💡", color: "#22c55e", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-entertainment", name: "Entertainment", icon: "🎬", color: "#8b5cf6", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-food", name: "Food", icon: "🍔", color: "#f59e0b", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-salary", name: "Salary", icon: "💰", color: "#0ea5e9", kind: "income", createdAt: "2026-01-01T00:00:00.000Z" },
];

const GTCO_HEADER = [
  "Trans. Date",
  "Value Date",
  "Reference",
  "Debits",
  "Credits",
  "Balance",
  "Originating Branch",
  "Remarks",
];

const OPAY_HEADER = [
  "Trans. Time",
  "Value Date",
  "Description",
  "Debit(₦)",
  "Credit(₦)",
  "Balance After(₦)",
  "Channel",
  "Transaction Reference",
];

// PalmPay's real 5-column export table header (Prompt 8J). "Money In"/"Money
// Out" are (NGN) COLUMNS here — unlike Kuda's section labels — and the whole
// phrase set scores 11 (3+2+2+2+2) against the registry's min of 6.
const PALMPAY_HEADER = [
  "Transaction Date",
  "Transaction Detail",
  "Money In (NGN)",
  "Money Out (NGN)",
  "Transaction ID",
];

// Kuda's real table header — OCR lines arrive as ONE CELL, so the header
// lives inside a single cell (kudaHeaderScore scans the token stream).
const KUDA_HEADER = ["Date/Time Money In Money Out Category To/From Description Balance"];

const GTCO_STATEMENT = [
  ["GTB Account Statement", "", "", "", "", "", "", ""],
  GTCO_HEADER,
  ["10/08/2026", "10/08/2026", "GT-001", "500,000.00", "", "1,200,000.00", "VI 001", "RENT PAYMENT"],
  ["10/08/2026", "10/08/2026", "GT-002", "", "900,000.00", "2,100,000.00", "VI 001", "SALARY"],
  ["11/08/2026", "11/08/2026", "GT-003", "50,000.00", "", "2,050,000.00", "VI 012", "NIP TRANSFER TO PALMPAY"],
  ["11/08/2026", "11/08/2026", "GT-004", "4.00", "", "2,049,996.00", "VI 001", "SMS ALERT CHARGE"],
  ["12/08/2026", "12/08/2026", "GT-005", "52.50", "", "2,049,943.50", "VI 001", "Commission on NIP Transfer CHARGES"],
  ["12/08/2026", "12/08/2026", "GT-006", "10.50", "", "2,049,933.00", "VI 001", "VAT CHARGES"],
  ["31/08/2026", "31/08/2026", "GT-007", "", "12,345.67", "2,062,278.67", "", "INTEREST CAPITALISED"],
  ["13/08/2026", "13/08/2026", "GT-008", "10.00", "", "2,062,268.67", "VI 001", "USSD Charge"],
  ["14/08/2026", "14/08/2026", "GT-009", "", "100,000.00", "2,162,268.67", "VI 001", "CASH DEPOSIT"],
  ["31/13/2026", "31/13/2026", "GT-010", "500.00", "", "2,161,768.67", "VI 001", "BAD DATE ROW"],
];

const OPAY_STATEMENT = [
  ["OPay Account Statement", "", "", "", "", "", "", "", ""],
  ["S/N", ...OPAY_HEADER],
  ["1", "2026-08-12 09:15:00", "2026-08-12", "Mobile Data | MTN | 3.2GB 2 Days Plan", "₦1,500.00", "", "₦98,500.00", "OPay App", "OP-001"],
  ["2", "2026-08-12 09:15:01", "2026-08-12", "SALARY", "", "₦500,000.00", "₦598,500.00", "OPay App", "OP-002"],
  ["3", "2026-08-13 10:00:00", "2026-08-13", "Transfer to DAVID OSAHON OGBEIDE | PalmPay", "₦50,000.00", "", "₦548,500.00", "OPay App", "OP-003"],
  ["4", "2026-08-13 10:00:01", "2026-08-13", "Stamp Duty", "₦50.00", "", "₦548,450.00", "USSD", "OP-004"],
  ["5", "2026-08-13 10:00:02", "2026-08-13", "VAT on Transfer Fee", "₦2.00", "", "₦548,448.00", "USSD", "OP-005"],
  ["6", "2026-08-13 10:00:03", "2026-08-13", "USSD Charge", "₦10.00", "", "₦548,438.00", "USSD", "OP-006"],
  ["7", "2026-08-13 10:00:04", "2026-08-13", "SMS Alert Charge", "₦4.00", "", "₦548,434.00", "OPay App", "OP-007"],
  ["8", "2026-08-14 00:00:01", "2026-08-14", "OWealth Interest Earned", "", "₦12,345.67", "₦560,779.67", "OPay App", "OP-008"],
  ["9", "2026-08-15 07:30:00", "2026-08-15", "Auto-save to OWealth Balance", "₦10,000.00", "", "₦550,779.67", "OPay App", "OP-009"],
  ["10", "2026-08-15 07:30:05", "2026-08-15", "OWealth Deposit (Transaction Refund)", "", "₦5,000.00", "₦555,779.67", "OPay App", "OP-010"],
  ["11", "2026-08-13 10:00:10", "2026-08-13", "OWealth Withdrawal (Transaction Payment)", "₦50,000.00", "", "₦498,438.00", "OPay App", "OP-011"],
  ["12", "2026-08-16 11:00:00", "2026-08-16", "TRF", "₦200.00", "", "₦498,238.00", "OPay App", "OP-012"],
];

const CONTEXT = { currency: "NGN" as const };

describe("detectStatementFormat", () => {
  it("detects a GTCO header from column vocabulary", () => {
    const detection = detectStatementFormat(GTCO_STATEMENT);
    expect(detection.bank).toBe("gtco");
    expect(detection.reason).toContain("GTCO");
  });

  it("detects an OPay header from column vocabulary", () => {
    const detection = detectStatementFormat(OPAY_STATEMENT);
    expect(detection.bank).toBe("opay");
    expect(detection.reason).toContain("OPay");
  });

  it("recognizes a GTCO header without branch or reference columns via tie-break", () => {
    const cells = [
      ["Trans. Date", "Value Date", "Debits", "Credits", "Balance", "Remarks"],
      ["10/08/2026", "10/08/2026", "500.00", "", "1,000.00", "RENT"],
    ];
    expect(detectStatementFormat(cells).bank).toBe("gtco");
  });

  it("recognizes a minimal OPay header without channel or reference", () => {
    const cells = [
      ["Trans. Time", "Value Date", "Description", "Debit(₦)", "Credit(₦)", "Balance After(₦)"],
      ["2026-08-12 09:15:00", "2026-08-12", "RENT", "500.00", "", "1,000.00"],
    ];
    expect(detectStatementFormat(cells).bank).toBe("opay");
  });

  it("does not recognize a generic bank header", () => {
    const cells = [
      ["Date", "Description", "Amount"],
      ["12/08/2026", "RENT", "500,000.00"],
    ];
    const detection = detectStatementFormat(cells);
    expect(detection.bank).toBe("unknown");
    expect(detection.reason).toContain("no bank header");
  });

  it("does not recognize blank cells", () => {
    expect(detectStatementFormat([["", "", ""], ["", "", ""]]).bank).toBe("unknown");
  });

  it("never consults the bank name or file name", () => {
    const gtbTitle = [["Guaranty Trust Bank Statement"], GTCO_HEADER];
    const opayTitle = [["OPay Statement of Account"], OPAY_HEADER];
    expect(detectStatementFormat(gtbTitle).bank).toBe("gtco");
    expect(detectStatementFormat(opayTitle).bank).toBe("opay");
  });

  it("detects a PalmPay header from its 5-column vocabulary", () => {
    const detection = detectStatementFormat([PALMPAY_HEADER]);
    expect(detection.bank).toBe("palmpay");
    expect(detection.reason).toContain("PalmPay");
  });

  it("detects a Kuda header from its phrase vocabulary", () => {
    expect(detectStatementFormat([KUDA_HEADER]).bank).toBe("kuda");
  });

  describe("cross-bank detection (Prompt 8J) — one bank's statement is never detected as another", () => {
    const statements: ReadonlyArray<string[][]> = [
      [GTCO_HEADER],
      [OPAY_HEADER],
      [KUDA_HEADER],
      [PALMPAY_HEADER],
    ];
    const expected = ["gtco", "opay", "kuda", "palmpay"] as const;

    it("each bank's header detects as ITSELF (never another supported bank)", () => {
      statements.forEach((cells, index) => {
        const detection = detectStatementFormat(cells);
        expect(detection.bank).toBe(expected[index]);
        // The real 4-bank registry must not report a valid bank as unknown.
        expect(detection.bank).not.toBe("unknown");
      });
    });

    it("the PalmPay header is not GTCO, OPay or Kuda (and vice-versa)", () => {
      // PalmPay's Money In/Money Out columns would tempt a Kuda misread
      // (shared "money in/out" phrases) — Kuda needs ≥ 8, PalmPay's header
      // scores 4 there, GTCO/OPay score 3 each: none qualifies.
      expect(detectStatementFormat([PALMPAY_HEADER]).bank).toBe("palmpay");
      // The GTCO header is never OPay even though the OPay vocabulary scores
      // 13 on it — the distinctive tie-break keeps GTCO's own columns the
      // winner; and no PalmPay/Kuda reader sees evidence in it.
      expect(detectStatementFormat([GTCO_HEADER]).bank).toBe("gtco");
      expect(detectStatementFormat([OPAY_HEADER]).bank).toBe("opay");
      expect(detectStatementFormat([KUDA_HEADER]).bank).toBe("kuda");
    });
  });
});

describe("processStatement — GTCO pipeline", () => {
  it("runs detection → parser → normalization → classification → relationships", () => {
    const preview = processStatement({
      cells: GTCO_STATEMENT,
      context: CONTEXT,
      categories: CATEGORIES,
    });

    expect(preview.detectedBank).toBe("gtco");
    expect(preview.skipped).toBe(1);
    expect(preview.errors).toEqual([{ row: 12, reason: "invalid date" }]);

    const transactions = preview.transactions;
    expect(transactions).toHaveLength(9);
    expect(transactions.map((tx) => tx.type)).toEqual([
      "expense",
      "income",
      "transfer",
      "bank-fee",
      "bank-fee",
      "tax",
      "interest",
      "bank-fee",
      "unknown",
    ]);

    const [rent, salary, transfer, sms, commission, vat, interest, ussd, deposit] = transactions;
    expect(rent.categoryId).toBe("c-rent");
    expect(rent.confidence).toBe("high");
    expect(rent.needsReview).toBe(false);
    expect(salary.categoryId).toBe("c-salary");
    expect(transfer.provider).toBe("PalmPay");
    expect(transfer.merchant).toBe("PALMPAY");
    expect(transfer.direction).toBe("out");
    expect(sms.type).toBe("bank-fee");
    expect(commission.debitAmount).toBe(5_250);
    expect(vat.type).toBe("tax");
    expect(interest.type).toBe("interest");
    expect(interest.direction).toBe("in");
    expect(ussd.debitAmount).toBe(1_000);
    expect(deposit.type).toBe("unknown");
    expect(deposit.needsReview).toBe(true);
    expect(deposit.status).toBe("draft");

    expect(preview.report.duplicates).toEqual([]);
    expect(preview.report.links).toEqual([]);
    expect(preview.report.movementIds).toEqual([]);
  });
});

describe("processStatement — OPay pipeline", () => {
  it("runs detection → parser → normalization → classification → relationships", () => {
    const preview = processStatement({
      cells: OPAY_STATEMENT,
      context: CONTEXT,
      categories: CATEGORIES,
    });

    expect(preview.detectedBank).toBe("opay");
    expect(preview.skipped).toBe(0);
    expect(preview.errors).toEqual([]);

    const transactions = preview.transactions;
    expect(transactions).toHaveLength(12);
    expect(transactions.map((tx) => tx.type)).toEqual([
      "expense",
      "income",
      "transfer",
      "tax",
      "tax",
      "bank-fee",
      "bank-fee",
      "interest",
      "savings",
      "refund",
      "internal-transfer",
      "unknown",
    ]);

    const [data, salary, transfer, stampDuty, vat, ussd, sms, interest, autoSave, refund, withdrawal, unknown] =
      transactions;

    expect(data.categoryId).toBe("c-utilities");
    expect(data.provider).toBe("MTN");
    expect(salary.categoryId).toBe("c-salary");
    expect(transfer.merchant).toBe("DAVID OSAHON OGBEIDE");
    expect(transfer.provider).toBe("PalmPay");
    expect(stampDuty.type).toBe("tax");
    expect(vat.type).toBe("tax");
    expect(ussd.type).toBe("bank-fee");
    expect(sms.type).toBe("bank-fee");
    expect(interest.type).toBe("interest");
    expect(autoSave.type).toBe("savings");
    expect(refund.type).toBe("refund");
    expect(withdrawal.type).toBe("internal-transfer");
    expect(unknown.type).toBe("unknown");
    expect(unknown.needsReview).toBe(true);
  });

  it("detects the funding pair between a transfer and its OWealth withdrawal", () => {
    const preview = processStatement({
      cells: OPAY_STATEMENT,
      context: CONTEXT,
      categories: CATEGORIES,
    });

    expect(preview.report.links).toHaveLength(1);
    const [link] = preview.report.links;
    expect(link.kind).toBe("funding-pair");
    expect(link.confidence).toBe("high");
    expect(link.fromId).toBe(preview.transactions[2].id);
    expect(link.toId).toBe(preview.transactions[10].id);

    expect(preview.report.movementIds).toEqual([
      preview.transactions[8].id,
      preview.transactions[10].id,
    ]);
    expect(preview.report.duplicates).toEqual([]);
  });

  it("flags true duplicates detected through the full pipeline", () => {
    const cells = [
      OPAY_HEADER,
      ["2026-08-13 10:00:04", "2026-08-13", "SMS Alert Charge", "₦4.00", "", "₦548,434.00", "OPay App", "OP-007"],
      ["2026-08-13 10:00:04", "2026-08-13", "SMS Alert Charge", "₦4.00", "", "₦548,434.00", "OPay App", "OP-007"],
      ["2026-08-13 10:00:05", "2026-08-13", "SMS Alert Charge", "₦4.00", "", "₦548,430.00", "OPay App", "OP-021"],
    ];
    const preview = processStatement({ cells, context: CONTEXT, categories: CATEGORIES });
    expect(preview.report.duplicates).toHaveLength(1);
    expect(preview.report.duplicates[0].ids).toHaveLength(2);
    expect(preview.report.duplicates[0].signals).toContain("same-reference");
  });
});

describe("processStatement — unsupported statements (Prompt 7A)", () => {
  it("reports an unrecognized statement as unsupported with a useful explanation", () => {
    const cells = [
      ["Date", "Description", "Amount"],
      ["12/08/2026", "RENT PAYMENT", "500,000.00"],
      ["12/08/2026", "SALARY", "900,000.00"],
    ];
    const preview = processStatement({ cells, context: CONTEXT, categories: CATEGORIES });

    expect(preview.status).toBe("unsupported");
    expect(preview.detectedBank).toBe("unknown");
    expect(preview.transactions).toEqual([]);
    expect(preview.skipped).toBe(0);
    expect(preview.detectionReason).toContain("no bank header vocabulary found");
    expect(preview.unsupportedReason).toBeTruthy();
  });

  it("explains why and never guesses — no transactions are invented", () => {
    const cells = [
      ["Date", "Description", "Amount"],
      ["12/08/2026", "RENT PAYMENT", "500,000.00"],
    ];
    const preview = processStatement({ cells, context: CONTEXT, categories: CATEGORIES });

    expect(preview.unsupportedReason).toContain("recognize");
    expect(preview.unsupportedReason).toContain("GTCO, OPay");
    expect(preview.unsupportedReason).toContain("Nothing was read");
    expect(preview.transactions).toHaveLength(0);
    expect(preview.report.duplicates).toEqual([]);
    expect(preview.report.links).toEqual([]);
  });
});

describe("statement registry — adding a parser never touches the engine (Prompt 7A)", () => {
  const MOCK_HEADER = ["Mock Date", "Mock Amount", "Mock Description"];

  function mockHeaderScore(row: readonly string[]): number {
    let score = 0;
    for (const cell of row) {
      const token = String(cell ?? "").trim().toLowerCase();
      if (token === "mock date") score += 4;
      if (token === "mock amount") score += 3;
      if (token === "mock description") score += 2;
    }
    return score;
  }

  const MOCK_ID = "mock" as BankSource;

  const mockParser: BankStatementParser = {
    id: MOCK_ID,
    label: "MockBank",
    headerScore: mockHeaderScore,
    distinctiveTokens: ["mock date", "mock amount", "mock description"],
    minHeaderScore: 5,
    capabilities: { ocrAware: false, wrappedLines: false },
    parse: (cells, context, _rowYs) => ({
      transactions: cells.slice(1).map((row, offset): NormalizedBankTransaction => {
        const amount = Number(String(row[1] ?? "").replace(/,/g, ""));
        return {
          id: `mk-r${offset + 2}`,
          transactionDate: String(row[0] ?? "") || null,
          description: String(row[2] ?? "") || "(no description)",
          debitAmount: amount < 0 ? Math.abs(amount) * 100 : undefined,
          creditAmount: amount >= 0 ? amount * 100 : undefined,
          currency: context.currency,
          sourceBank: MOCK_ID,
          type: "unknown",
          direction: amount < 0 ? "out" : "in",
          confidence: "none",
          status: "draft",
          categoryId: null,
          row: offset + 2,
        };
      }),
      skipped: 0,
      errors: [],
    }),
  };

  const EXTENDED = [mockParser, ...BANK_PARSERS];

  it("detects GTCO and OPay exactly as before when a parser is added", () => {
    expect(detectStatementFormat(GTCO_STATEMENT, EXTENDED).bank).toBe("gtco");
    expect(detectStatementFormat(OPAY_STATEMENT, EXTENDED).bank).toBe("opay");
    expect(detectStatementFormat(GTCO_STATEMENT).bank).toBe("gtco");
    expect(detectStatementFormat(OPAY_STATEMENT).bank).toBe("opay");
  });

  it("detects the new bank's own header without touching the others", () => {
    const cells = [
      MOCK_HEADER,
      ["2026-08-01", "-5,000", "MOCK RENT"],
      ["2026-08-02", "90,000", "MOCK SALARY"],
    ];
    const detection = detectStatementFormat(cells, EXTENDED);
    expect(detection.bank).toBe("mock");
    expect(detection.reason).toContain("MockBank");
  });

  it("keeps unknown statements unsupported with the extended registry", () => {
    const cells = [
      ["Date", "Description", "Amount"],
      ["12/08/2026", "RENT", "500.00"],
    ];
    expect(detectStatementFormat(cells, EXTENDED).bank).toBe("unknown");
    const preview = processStatement({ cells, context: CONTEXT, categories: CATEGORIES }, EXTENDED);
    expect(preview.status).toBe("unsupported");
    expect(preview.transactions).toEqual([]);
  });

  it("runs the new bank through the full pipeline — detection → parser → classification", () => {
    const cells = [
      MOCK_HEADER,
      ["2026-08-01", "-5,000", "MOCK RENT"],
      ["2026-08-02", "90,000", "MOCK SALARY"],
    ];
    const preview = processStatement(
      { cells, context: CONTEXT, categories: CATEGORIES },
      EXTENDED,
    );

    expect(preview.status).toBe("supported");
    expect(preview.detectedBank).toBe("mock");
    expect(preview.detectedLabel).toBe("MockBank");
    expect(preview.transactions).toHaveLength(2);
    const [rent, salary] = preview.transactions;
    expect(rent.debitAmount).toBe(500_000);
    expect(rent.direction).toBe("out");
    expect(rent.sourceBank).toBe("mock");
    expect(salary.creditAmount).toBe(9_000_000);
    expect(salary.direction).toBe("in");
    expect(preview.report.duplicates).toEqual([]);
  });

  it("processes the existing banks unchanged through the extended registry", () => {
    const gtco = processStatement(
      { cells: GTCO_STATEMENT, context: CONTEXT, categories: CATEGORIES },
      EXTENDED,
    );
    const opay = processStatement(
      { cells: OPAY_STATEMENT, context: CONTEXT, categories: CATEGORIES },
      EXTENDED,
    );
    expect(gtco.status).toBe("supported");
    expect(gtco.detectedBank).toBe("gtco");
    expect(gtco.transactions).toHaveLength(9);
    expect(opay.status).toBe("supported");
    expect(opay.detectedBank).toBe("opay");
    expect(opay.transactions).toHaveLength(12);
  });

  it("does not match the new bank when the registry is not extended", () => {
    const cells = [
      MOCK_HEADER,
      ["2026-08-01", "-5,000", "MOCK RENT"],
    ];
    expect(detectStatementFormat(cells).bank).toBe("unknown");
    expect(processStatement({ cells, context: CONTEXT, categories: CATEGORIES }).status).toBe(
      "unsupported",
    );
  });
});

describe("processStatement — safety", () => {
  it("never writes to the budget and never mutates the input cells", () => {
    const cells = OPAY_STATEMENT.map((row) => [...row]);
    const snapshot = JSON.stringify(cells);
    const preview = processStatement({ cells, context: CONTEXT, categories: CATEGORIES });

    expect(preview.transactions.every((tx) => tx.status !== "imported")).toBe(true);
    expect(JSON.stringify(cells)).toBe(snapshot);
  });
});

describe("ledgerKindFor — what can be booked", () => {
  it("maps expense/income kinds and unknown-by-direction to a ledger side", () => {
    const row = (type: Parameters<typeof ledgerKindFor>[0]["type"], direction: BankDirection) =>
      ({ type, direction });
    expect(ledgerKindFor(row("expense", "out"))).toBe("expense");
    expect(ledgerKindFor(row("income", "in"))).toBe("income");
    expect(ledgerKindFor(row("refund", "in"))).toBe("income");
    expect(ledgerKindFor(row("interest", "in"))).toBe("income");
    expect(ledgerKindFor(row("unknown", "out"))).toBe("expense");
    expect(ledgerKindFor(row("unknown", "in"))).toBe("income");
  });

  it("never silently defaults an unresolved direction to expense", () => {
    // A genuinely ambiguous row (Kuda: no trusted balance delta, no
    // direction tag) is not bookable until the user assigns a type —
    // "expense" is a guess, not a default.
    expect(ledgerKindFor({ type: "unknown", direction: "unknown" })).toBeNull();
  });

  it("never maps money movements to a ledger side", () => {
    for (const type of ["transfer", "internal-transfer", "bank-fee", "tax", "loan-payment", "savings"] as const) {
      expect(ledgerKindFor({ type, direction: "out" })).toBeNull();
    }
  });
});

describe("prefillLedgerKindFor — the review screen's type pre-fill", () => {
  it("pre-fills expense for a resolved outflow the narration couldn't classify", () => {
    // Negative amount / debit column / negative balance delta — the parser
    // resolved direction "out"; the row shows Expense, still editable.
    expect(prefillLedgerKindFor({ type: "unknown", direction: "out" })).toBe("expense");
  });

  it("pre-fills income for a resolved inflow", () => {
    expect(prefillLedgerKindFor({ type: "unknown", direction: "in" })).toBe("income");
  });

  it("keeps the classified kind when classification had a signal", () => {
    // "Transfer to John" stays a transfer (never income), a refund stays a
    // refund — the prefill only fills what classification left unknown.
    expect(prefillLedgerKindFor({ type: "transfer", direction: "in" })).toBe("transfer");
    expect(prefillLedgerKindFor({ type: "refund", direction: "out" })).toBe("refund");
    expect(prefillLedgerKindFor({ type: "expense", direction: "out" })).toBe("expense");
    expect(prefillLedgerKindFor({ type: "income", direction: "in" })).toBe("income");
  });

  it("keeps 'unknown' when the direction itself is unresolved — never guesses", () => {
    expect(prefillLedgerKindFor({ type: "unknown", direction: "unknown" })).toBe("unknown");
  });
});

describe("planImport — the confirm step", () => {
  const base = (patch: Partial<ImportRow> = {}): ImportRow => ({
    id: "t1",
    type: "expense",
    direction: "out",
    categoryId: "c-rent",
    transactionDate: "2026-08-01",
    description: "RENT PAYMENT",
    debitAmount: 50_000_000,
    excluded: false,
    sourceBank: "opay",
    ...patch,
  });

  const emptySkip = {
    excluded: 0,
    movements: 0,
    noDate: 0,
    duplicates: 0,
    alreadyExisting: 0,
    possibleSkipped: 0,
    failed: 0,
  };

  it("turns reviewed ledger rows into ledger inputs", () => {
    const plan = planImport(
      [
        base({ id: "t1", type: "expense", categoryId: "c-rent", debitAmount: 50_000_000 }),
        base({
          id: "t2",
          type: "income",
          direction: "in",
          categoryId: "c-salary",
          creditAmount: 90_000_000,
          description: "SALARY",
          transactionDate: "2026-08-03",
        }),
      ],
      [],
    );

    expect(plan.inputs).toEqual([
      {
        categoryId: "c-rent",
        amount: 50_000_000,
        type: "expense",
        date: "2026-08-01",
        note: "RENT PAYMENT",
        importSource: {
          source: "statement-import",
          bank: "opay",
          reference: undefined,
          originalDescription: undefined,
          statementDate: undefined,
        },
      },
      {
        categoryId: "c-salary",
        amount: 90_000_000,
        type: "income",
        date: "2026-08-03",
        note: "SALARY",
        importSource: {
          source: "statement-import",
          bank: "opay",
          reference: undefined,
          originalDescription: undefined,
          statementDate: undefined,
        },
      },
    ]);
    expect(plan.missingCategory).toBe(0);
    expect(plan.skipped).toEqual(emptySkip);
  });

  it("preserves provenance on the mapped inputs", () => {
    const plan = planImport(
      [
        base({
          id: "t1",
          sourceBank: "gtco",
          reference: "GT-REF-200",
          originalDescription: "RENT FOR AUGUST-2026",
          valueDate: "2026-07-31",
          debitAmount: 12_000_000,
        }),
      ],
      [],
    );

    expect(plan.inputs[0].importSource).toEqual({
      source: "statement-import",
      bank: "gtco",
      reference: "GT-REF-200",
      originalDescription: "RENT FOR AUGUST-2026",
      statementDate: "2026-07-31",
    });
  });

  it("counts why rows cannot be imported and blocks on missing categories", () => {
    const plan = planImport(
      [
        base({ id: "t1", excluded: true }),
        base({ id: "t2", type: "transfer" }),
        base({ id: "t3", transactionDate: null }),
        base({ id: "t4", categoryId: null }),
        base({ id: "t5" }),
      ],
      [],
    );

    expect(plan.inputs).toHaveLength(1);
    expect(plan.skipped).toEqual({
      ...emptySkip,
      excluded: 1,
      movements: 1,
      noDate: 1,
    });
    expect(plan.missingCategory).toBe(1);
  });

  it("keeps the first importable row of each duplicate group", () => {
    const plan = planImport(
      [
        base({ id: "t1" }),
        base({ id: "t2", description: "RENT PAYMENT (copy)" }),
        base({ id: "t3" }),
      ],
      [{ ids: ["t1", "t2"], confidence: "high", signals: ["same-reference"] }],
    );

    expect(plan.inputs.map((input) => input.note)).toEqual(["RENT PAYMENT", "RENT PAYMENT"]);
    expect(plan.skipped.duplicates).toBe(1);
  });

  it("promotes the next row when the duplicate keeper was excluded", () => {
    const plan = planImport(
      [
        base({ id: "t1", excluded: true }),
        base({ id: "t2" }),
      ],
      [{ ids: ["t1", "t2"], confidence: "high", signals: ["same-reference"] }],
    );

    expect(plan.inputs.map((input) => input.note)).toEqual(["RENT PAYMENT"]);
    expect(plan.skipped.duplicates).toBe(0);
  });

  it("caps the note to the ledger's note limit", () => {
    const plan = planImport(
      [base({ id: "t1", description: "x".repeat(500) })],
      [],
    );
    expect(plan.inputs[0].note).toHaveLength(200);
  });

  it("counts rows with no amount as failed", () => {
    const plan = planImport(
      [base({ id: "t1", debitAmount: undefined })],
      [],
    );
    expect(plan.inputs).toHaveLength(0);
    expect(plan.skipped.failed).toBe(1);
  });

  describe("re-import detection against the existing ledger", () => {
    const ledger = [
      {
        id: "ledger-1",
        amount: 50_000_000,
        type: "expense" as const,
        date: "2026-08-01",
        note: "RENT PAYMENT",
        importSource: {
          source: "statement-import" as const,
          bank: "opay" as const,
          reference: "OP-001",
        },
      },
      {
        id: "ledger-2",
        amount: 1_200_000,
        type: "expense" as const,
        date: "2026-08-04",
        note: "MYSTERY CHARGE X7",
      },
    ];

    it("detects re-imports by the stored bank reference", () => {
      const plan = planImport(
        [base({ id: "t1", reference: "OP-001" })],
        [],
        ledger,
      );
      expect(plan.inputs).toHaveLength(0);
      expect(plan.skipped.alreadyExisting).toBe(1);
    });

    it("falls back to amount + date + note when no reference is stored", () => {
      const plan = planImport(
        [
          base({
            id: "t1",
            description: "MYSTERY CHARGE X7",
            debitAmount: 1_200_000,
            transactionDate: "2026-08-04",
          }),
          base({ id: "t2", description: "RENT PAYMENT", debitAmount: 50_000_000 }),
        ],
        [],
        ledger,
      );
      expect(plan.inputs.map((input) => input.note)).toEqual(["RENT PAYMENT"]);
      expect(plan.skipped.alreadyExisting).toBe(1);
    });

    it("does not flag same-amount different-description rows", () => {
      const plan = planImport(
        [base({ id: "t1", description: "MYSTERY CHARGE X7", debitAmount: 50_000_000 })],
        [],
        ledger,
      );
      expect(plan.inputs).toHaveLength(1);
      expect(plan.skipped.alreadyExisting).toBe(0);
    });

    it("imports possible duplicates by default — nothing is silently discarded", () => {
      const manual = [
        {
          id: "manual-rent",
          amount: 50_000_000,
          type: "expense" as const,
          date: "2026-08-01",
          note: "RENT PAID CASH",
        },
      ];
      const plan = planImport([base({ id: "t1" })], [], manual);
      expect(plan.inputs).toHaveLength(1);
      expect(plan.skipped).toEqual({ ...emptySkip, possibleSkipped: 0 });
    });

    it("skips possible duplicates the user chose to skip", () => {
      const manual = [
        {
          id: "manual-rent",
          amount: 50_000_000,
          type: "expense" as const,
          date: "2026-08-01",
          note: "RENT PAID CASH",
        },
      ];
      const plan = planImport([base({ id: "t1", skipAsDuplicate: true })], [], manual);
      expect(plan.inputs).toHaveLength(0);
      expect(plan.skipped).toEqual({ ...emptySkip, possibleSkipped: 1 });
    });

    it("already-imported rows never block import on a missing category", () => {
      const plan = planImport(
        [
          base({
            id: "t1",
            reference: "OP-001",
            categoryId: null,
          }),
        ],
        [],
        ledger,
      );
      expect(plan.inputs).toHaveLength(0);
      expect(plan.skipped.alreadyExisting).toBe(1);
      expect(plan.missingCategory).toBe(0);
    });
  });

  describe("Prompt 8H — safe, idempotent imports", () => {
    it("overlapping statements: importing January–March after January adds only the genuinely new rows", () => {
      const january = [
        base({ id: "j1", description: "JAN RENT", transactionDate: "2026-01-01", debitAmount: 50_000_000, reference: "OP-JAN-001" }),
        base({ id: "j2", type: "income", direction: "in", description: "JAN SALARY", transactionDate: "2026-01-05", creditAmount: 90_000_000, debitAmount: undefined, reference: "OP-JAN-002" }),
      ];
      const ledgerFromJanuary = [
        {
          id: "l-j1",
          amount: 50_000_000,
          type: "expense" as const,
          date: "2026-01-01",
          note: "JAN RENT",
          importSource: { source: "statement-import" as const, bank: "opay" as const, reference: "OP-JAN-001" },
        },
        {
          id: "l-j2",
          amount: 90_000_000,
          type: "income" as const,
          date: "2026-01-05",
          note: "JAN SALARY",
          importSource: { source: "statement-import" as const, bank: "opay" as const, reference: "OP-JAN-002" },
        },
      ];

      const januaryMarch = [
        ...january.map((row) => ({ ...row, id: `re-${row.id}` })),
        base({ id: "a3", description: "FEB RENT", transactionDate: "2026-02-01", debitAmount: 50_000_000, reference: "OP-FEB-001" }),
        base({ id: "a4", description: "MAR RENT", transactionDate: "2026-03-01", debitAmount: 50_000_000, reference: "OP-MAR-001" }),
      ];

      const plan = planImport(januaryMarch, [], ledgerFromJanuary);
      expect(plan.inputs.map((input) => input.note)).toEqual(["FEB RENT", "MAR RENT"]);
      expect(plan.skipped.alreadyExisting).toBe(2);
      // Nothing existing is ever deleted or rewritten by a plan.
      expect(ledgerFromJanuary).toHaveLength(2);
    });

    it("duplicate refunds: the same refund is never double-booked; distinct refunds both import", () => {
      const refundLedger = [
        {
          id: "l-r1",
          amount: 20_000_000,
          type: "income" as const,
          date: "2026-08-10",
          note: "REFUND FROM SHOPRITE",
          importSource: { source: "statement-import" as const, bank: "opay" as const, reference: "OP-RF-001" },
        },
      ];
      const sameRefundAgain = base({
        id: "t1",
        type: "refund",
        direction: "in",
        description: "REFUND FROM SHOPRITE",
        transactionDate: "2026-08-10",
        creditAmount: 20_000_000,
        debitAmount: undefined,
        reference: "OP-RF-001",
      });
      const distinctRefund = base({
        id: "t2",
        type: "refund",
        direction: "in",
        description: "REFUND FROM SHOPRITE",
        transactionDate: "2026-08-20",
        creditAmount: 20_000_000,
        debitAmount: undefined,
        reference: "OP-RF-002",
      });

      const plan = planImport([sameRefundAgain, distinctRefund], [], refundLedger);
      expect(plan.inputs).toHaveLength(1);
      expect(plan.inputs[0].note).toBe("REFUND FROM SHOPRITE");
      expect(plan.skipped.alreadyExisting).toBe(1);
    });

    it("a reference-less refund with identical details is caught by the conservative fallback", () => {
      const manualLike = [
        {
          id: "l-r",
          amount: 20_000_000,
          type: "income" as const,
          date: "2026-08-10",
          note: "REFUND FROM SHOPRITE",
        },
      ];
      const plan = planImport(
        [
          base({
            id: "t1",
            type: "refund",
            direction: "in",
            description: "REFUND FROM SHOPRITE",
            transactionDate: "2026-08-10",
            creditAmount: 20_000_000,
            debitAmount: undefined,
          }),
        ],
        [],
        manualLike,
      );
      expect(plan.inputs).toHaveLength(0);
      expect(plan.skipped.alreadyExisting).toBe(1);
    });

    it("duplicate fees: fee rows are movements — never imported, never double-booked, even on re-import", () => {
      const feeRows = [
        base({ id: "f1", type: "bank-fee", description: "SMS ALERT CHARGE", debitAmount: 2_000, reference: "OP-FEE-1" }),
        base({ id: "f2", type: "bank-fee", description: "SMS ALERT CHARGE", debitAmount: 2_000, reference: "OP-FEE-2" }),
      ];
      const first = planImport(feeRows, [], []);
      expect(first.inputs).toHaveLength(0);
      expect(first.skipped.movements).toBe(2);
      expect(first.skipped.alreadyExisting).toBe(0);

      // A second import of the same fee rows still writes nothing — the
      // ledger (which rightly has no fee rows) is left untouched.
      const again = planImport(
        feeRows.map((row) => ({ ...row, id: `again-${row.id}` })),
        [],
        [],
      );
      expect(again.inputs).toHaveLength(0);
      expect(again.skipped.movements).toBe(2);
    });

    it("an empty statement plans to import nothing and changes nothing", () => {
      const ledger = [
        {
          id: "l-1",
          amount: 50_000_000,
          type: "expense" as const,
          date: "2026-08-01",
          note: "RENT PAYMENT",
        },
      ];
      const plan = planImport([], [], ledger);
      expect(plan.inputs).toEqual([]);
      expect(plan.importedIds).toEqual([]);
      expect(plan.skipped).toEqual(emptySkip);
      expect(plan.missingCategory).toBe(0);
      expect(ledger).toHaveLength(1);
    });
  });

describe("processStatement — learned rules (Prompt 6A)", () => {
  const learned = [
    {
      id: "lr-1",
      source: "statement-import" as const,
      kind: "provider" as const,
      key: "mtn",
      categoryId: "c-food",
      strength: 3,
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("applies an active learned rule to the preview classification", () => {
    const preview = processStatement({
      cells: OPAY_STATEMENT,
      context: { currency: "NGN", sourceBank: "opay" },
      categories: CATEGORIES,
      learnedRules: learned,
    });
    const mtn = preview.transactions.find((tx) => tx.description.includes("MTN"))!;
    expect(mtn.type).toBe("expense");
    expect(mtn.categoryId).toBe("c-food");
    expect(mtn.confidence).toBe("high");
    expect(mtn.needsReview).toBe(false);
    expect(mtn.classificationReason).toBe("learned:provider:mtn");
  });

  it("ignores learned rules that are not yet active", () => {
    const preview = processStatement({
      cells: OPAY_STATEMENT,
      context: { currency: "NGN", sourceBank: "opay" },
      categories: CATEGORIES,
      learnedRules: [{ ...learned[0], enabled: false }],
    });
    const mtn = preview.transactions.find((tx) => tx.description.includes("MTN"))!;
    expect(mtn.classificationReason).not.toBe("learned:provider:mtn");
    expect(mtn.categoryId).toBe("c-utilities");
  });

  it("reports which session rows were imported (learning signal)", () => {
    const plan = planImport(
      [
        base({ id: "t1", description: "RENT PAYMENT", debitAmount: 50_000_000 }),
        base({ id: "t2", description: "SMS ALERT CHARGE", type: "bank-fee" }),
      ],
      [],
      [],
    );
    expect(plan.importedIds).toEqual(["t1"]);
  });
});
});

describe("explicit duplicate resolution (FR-23)", () => {
  const row = (patch: Partial<ImportRow> = {}): ImportRow => ({
    id: "t1",
    type: "expense",
    direction: "out",
    categoryId: "c-rent",
    transactionDate: "2026-08-01",
    description: "RENT PAYMENT",
    debitAmount: 50_000_000,
    excluded: false,
    sourceBank: "opay",
    ...patch,
  });

  const ledger = [
    {
      id: "existing-rent",
      date: "2026-08-01",
      amount: 50_000_000,
      type: "expense" as const,
      note: "RENT PAYMENT",
    },
  ];

  it("blocks the import while a flagged row is unanswered", () => {
    const plan = planImport(
      [row({ duplicateResolution: "unresolved", duplicateOfId: "existing-rent" })],
      [],
      ledger,
    );
    expect(plan.unresolvedDuplicates).toBe(1);
    // Nothing is written, and nothing is silently discarded either.
    expect(plan.inputs).toHaveLength(0);
    expect(plan.replacedTransactionIds).toEqual([]);
  });

  it("skip: keeps the existing entry and imports nothing", () => {
    const plan = planImport(
      [row({ duplicateResolution: "skip", duplicateOfId: "existing-rent" })],
      [],
      ledger,
    );
    expect(plan.inputs).toHaveLength(0);
    expect(plan.skipped.possibleSkipped).toBe(1);
    expect(plan.replacedTransactionIds).toEqual([]);
    expect(plan.unresolvedDuplicates).toBe(0);
  });

  it("import: writes it as a separate transaction, deleting nothing", () => {
    const plan = planImport(
      [row({ duplicateResolution: "import", duplicateOfId: "existing-rent" })],
      [],
      ledger,
    );
    expect(plan.inputs).toHaveLength(1);
    expect(plan.inputs[0].note).toBe("RENT PAYMENT");
    expect(plan.replacedTransactionIds).toEqual([]);
    // The identity check would have discarded this row; the user's explicit
    // "they are different" must override that.
    expect(plan.skipped.alreadyExisting).toBe(0);
  });

  it("replace: writes the new one and names the old one for deletion", () => {
    const plan = planImport(
      [row({ duplicateResolution: "replace", duplicateOfId: "existing-rent" })],
      [],
      ledger,
    );
    expect(plan.inputs).toHaveLength(1);
    expect(plan.replacedTransactionIds).toEqual(["existing-rent"]);
    expect(plan.skipped.possibleSkipped).toBe(0);
  });

  it("leaves unflagged rows on the existing path, untouched", () => {
    // No `duplicateResolution` at all: the pre-FR-23 behaviour exactly.
    const plan = planImport([row({ description: "NEW SPEND", debitAmount: 900 })], [], ledger);
    expect(plan.inputs).toHaveLength(1);
    expect(plan.unresolvedDuplicates).toBe(0);
    expect(plan.replacedTransactionIds).toEqual([]);
  });

  it("resolves each flagged row independently", () => {
    const plan = planImport(
      [
        row({ id: "a", duplicateResolution: "skip", duplicateOfId: "existing-rent" }),
        row({ id: "b", description: "B", debitAmount: 111, duplicateResolution: "import" }),
        row({
          id: "c",
          description: "C",
          debitAmount: 222,
          duplicateResolution: "replace",
          duplicateOfId: "existing-rent",
        }),
      ],
      [],
      ledger,
    );
    expect(plan.inputs.map((i) => i.note).sort()).toEqual(["B", "C"]);
    expect(plan.replacedTransactionIds).toEqual(["existing-rent"]);
    expect(plan.skipped.possibleSkipped).toBe(1);
  });
});

describe("planImport — unresolved-direction rows", () => {
  const base = (patch: Partial<ImportRow> = {}): ImportRow => ({
    id: "kd-1",
    type: "unknown",
    direction: "unknown",
    categoryId: "c-rent",
    transactionDate: "2026-08-01",
    description: "Transfer to JOHN DOE",
    unresolvedAmount: 50_000,
    excluded: false,
    sourceBank: "kuda",
    ...patch,
  });

  it("books the preserved magnitude on the side the USER assigned", () => {
    // The user typed the row as an expense in review — the magnitude moves
    // to that side; nothing was guessed at parse time.
    const plan = planImport([base({ type: "expense" })], []);
    expect(plan.inputs).toHaveLength(1);
    expect(plan.inputs[0]).toMatchObject({ amount: 50_000, type: "expense" });
    expect(plan.skipped.movements).toBe(0);
  });

  it("skips a row the user never typed — no silent expense default", () => {
    const plan = planImport([base()], []);
    expect(plan.inputs).toHaveLength(0);
    expect(plan.skipped.movements).toBe(1);
    expect(plan.skipped.failed).toBe(0);
  });
});
