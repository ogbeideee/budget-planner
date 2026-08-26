// Cross-parser normalization consistency tests (Prompt 8F).
//
// The SAME conceptual transaction must normalize to the SAME representation
// regardless of bank format: same date, same debit/credit amount split, same
// direction, same balance, and — after classification — the same kind + same
// deterministic transaction type.
//
// The amount is always the statement's transaction amount, NEVER the running
// balance. Direction is a statement fact (debit/credit column or balance
// delta), never guessed from the narration, and never assumed to mean
// income/expense (an incoming transfer is still a transfer).

import { describe, expect, it } from "vitest";

import { classifyTransactions } from "../statementClassify";
import { checkAmountSanity } from "../statementNormalize";
import { parseGtcoStatement } from "../gtcoParser";
import { parseKudaStatement } from "../kudaParser";
import { parseOpayStatement } from "../opayParser";
import type { NormalizationContext, NormalizedBankTransaction } from "../statementTypes";
import type { Category } from "../types";

const CONTEXT: NormalizationContext = { currency: "NGN" };
const CATEGORIES: Category[] = [];

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

const KUDA_HEADER = [
  "Date/Time",
  "Money In",
  "Money Out",
  "Category",
  "To/From",
  "Description",
  "Balance",
];

function classified(parsed: {
  transactions: NormalizedBankTransaction[];
  errors: { row: number; reason: string }[];
}): NormalizedBankTransaction[] {
  expect(parsed.errors).toEqual([]);
  expect(parsed.transactions.length).toBeGreaterThan(0);
  return classifyTransactions(parsed.transactions, CATEGORIES);
}

function gtco(row: string[]): NormalizedBankTransaction {
  const [tx] = classified(parseGtcoStatement([GTCO_HEADER, row], CONTEXT));
  return tx;
}

function opay(row: string[]): NormalizedBankTransaction {
  const [tx] = classified(parseOpayStatement([OPAY_HEADER, row], CONTEXT));
  return tx;
}

function kuda(row: string[]): NormalizedBankTransaction {
  const [tx] = classified(parseKudaStatement([KUDA_HEADER, row], CONTEXT));
  return tx;
}

/** Asserts two rows normalized identically on every meaningful field. */
function expectEquivalent(
  got: NormalizedBankTransaction,
  expected: Partial<NormalizedBankTransaction> & {
    debitAmount?: number;
    creditAmount?: number;
    direction: NormalizedBankTransaction["direction"];
  },
) {
  expect(got.debitAmount).toBe(expected.debitAmount);
  expect(got.creditAmount).toBe(expected.creditAmount);
  expect(got.balanceAfter).toBe(expected.balanceAfter);
  expect(got.transactionDate).toBe(expected.transactionDate);
  expect(got.direction).toBe(expected.direction);
  expect(got.type).toBe(expected.type);
  expect(got.txType).toBe(expected.txType);
  expect(got.categoryId).toBeNull();
}

describe("8F — same conceptual transaction, same normalized representation", () => {
  it("an outgoing transfer normalizes identically across GTCO, OPay and Kuda", () => {
    const g = gtco([
      "10/08/2026",
      "10/08/2026",
      "GT-REF-001",
      "50,000.00",
      "",
      "150,000.00",
      "VI 001",
      "TRANSFER TO JOHN DOE",
    ]);
    const o = opay([
      "2026-08-10 09:00:00",
      "2026-08-10",
      "Transfer to JOHN DOE | PalmPay",
      "₦50,000.00",
      "",
      "₦150,000.00",
      "OPay App",
      "OP-REF-001",
    ]);
    const k = kuda(["10/08/26", "", "50,000.00", "outward transfer", "JOHN DOE", "150,000.00"]);

    for (const tx of [g, o, k]) {
      expectEquivalent(tx, {
        transactionDate: "2026-08-10",
        direction: "out",
        debitAmount: 5_000_000,
        creditAmount: undefined,
        balanceAfter: 15_000_000,
        type: "transfer",
        txType: "transfer",
      });
      // The description is the narration — never the reference or the balance.
      expect(tx.description).not.toBe("");
      expect(tx.description).not.toBe("150,000.00");
      expect(tx.description).not.toBe("GT-REF-001");
    }
  });

  it("an incoming transfer is still a transfer, never income, on every bank", () => {
    const g = gtco([
      "10/08/2026",
      "10/08/2026",
      "GT-REF-002",
      "",
      "20,000.00",
      "170,000.00",
      "VI 001",
      "TRANSFER FROM JOHN DOE",
    ]);
    const o = opay([
      "2026-08-10 10:00:00",
      "2026-08-10",
      "Transfer from JOHN DOE | OPay",
      "",
      "₦20,000.00",
      "₦170,000.00",
      "OPay App",
      "OP-REF-002",
    ]);
    const k = kuda(["10/08/26", "20,000.00", "", "local funds transfer", "JOHN DOE", "170,000.00"]);

    for (const tx of [g, o, k]) {
      expectEquivalent(tx, {
        transactionDate: "2026-08-10",
        direction: "in",
        debitAmount: undefined,
        creditAmount: 2_000_000,
        balanceAfter: 17_000_000,
        type: "transfer",
        txType: "transfer",
      });
    }
  });

  it("stamp duty is a tax with the same shape on every bank", () => {
    const g = gtco([
      "12/08/2026",
      "12/08/2026",
      "GT-REF-003",
      "10.50",
      "",
      "1,000.00",
      "",
      "STAMP DUTY",
    ]);
    const o = opay([
      "2026-08-12 10:00:00",
      "2026-08-12",
      "Stamp Duty",
      "₦10.50",
      "",
      "₦1,000.00",
      "OPay App",
      "OP-REF-003",
    ]);
    const k = kuda(["12/08/26", "", "10.50", "stamp duty", "", "Stamp Duty", "1,000.00"]);

    for (const tx of [g, o, k]) {
      expectEquivalent(tx, {
        transactionDate: "2026-08-12",
        direction: "out",
        debitAmount: 1_050,
        creditAmount: undefined,
        balanceAfter: 100_000,
        type: "tax",
        txType: "stamp-duty",
      });
    }
  });

  it("credited interest normalizes identically on every bank", () => {
    const g = gtco([
      "25/08/2026",
      "25/08/2026",
      "GT-REF-004",
      "",
      "12,345.67",
      "112,345.67",
      "",
      "INTEREST CAPITALISED",
    ]);
    const o = opay([
      "2026-08-25 00:00:01",
      "2026-08-25",
      "OWealth Interest Earned",
      "",
      "₦12,345.67",
      "₦112,345.67",
      "OPay App",
      "OP-REF-004",
    ]);
    const k = kuda([
      "25/08/26",
      "12,345.67",
      "",
      "interest",
      "",
      "Interest Capitalised",
      "112,345.67",
    ]);

    for (const tx of [g, o, k]) {
      expectEquivalent(tx, {
        transactionDate: "2026-08-25",
        direction: "in",
        debitAmount: undefined,
        creditAmount: 1_234_567,
        balanceAfter: 11_234_567,
        type: "interest",
        txType: "interest",
      });
    }
  });

  it("an identical narration produces an identical representation on every bank", () => {
    const narration = "OWealth Withdrawal (Transaction Payment)";
    const g = gtco(["10/08/2026", "10/08/2026", "GT-REF-005", "10,000.00", "", "90,000.00", "VI 001", narration]);
    const o = opay([
      "2026-08-10 11:00:00",
      "2026-08-10",
      narration,
      "₦10,000.00",
      "",
      "₦90,000.00",
      "OPay App",
      "OP-REF-005",
    ]);
    const k = kuda(["10/08/26", "", "10,000.00", "internal transfer", narration, "90,000.00"]);

    for (const tx of [g, o, k]) {
      expectEquivalent(tx, {
        transactionDate: "2026-08-10",
        direction: "out",
        debitAmount: 1_000_000,
        creditAmount: undefined,
        balanceAfter: 9_000_000,
        type: "internal-transfer",
        txType: "internal-transfer",
      });
    }
  });

  it("a refund narration normalizes identically on every bank", () => {
    const narration = "OWealth Deposit (Transaction Refund)";
    const g = gtco(["14/08/2026", "14/08/2026", "GT-REF-006", "", "5,000.00", "95,000.00", "", narration]);
    const o = opay([
      "2026-08-14 07:30:05",
      "2026-08-14",
      narration,
      "",
      "₦5,000.00",
      "₦95,000.00",
      "OPay App",
      "OP-REF-006",
    ]);
    const k = kuda(["14/08/26", "5,000.00", "", "refund", narration, "95,000.00"]);

    for (const tx of [g, o, k]) {
      expectEquivalent(tx, {
        transactionDate: "2026-08-14",
        direction: "in",
        debitAmount: undefined,
        creditAmount: 500_000,
        balanceAfter: 9_500_000,
        type: "refund",
        txType: "refund",
      });
    }
  });
});

describe("8F — the amount is the transaction amount, never the balance", () => {
  it("GTCO takes the amount from the Debits column, not the Balance column", () => {
    const tx = gtco([
      "10/08/2026",
      "10/08/2026",
      "GT-REF-007",
      "50,000.00",
      "",
      "9,999,999.00",
      "VI 001",
      "TRANSFER",
    ]);
    expect(tx.debitAmount).toBe(5_000_000);
    expect(tx.balanceAfter).toBe(999_999_900);
    expect(tx.debitAmount).not.toBe(tx.balanceAfter);
  });

  it("OPay takes the amount from the Debit column, not the balance", () => {
    const tx = opay([
      "2026-08-10 09:00:00",
      "2026-08-10",
      "TRANSFER",
      "₦50,000.00",
      "",
      "₦8,888,888.00",
      "OPay App",
      "OP-REF-007",
    ]);
    expect(tx.debitAmount).toBe(5_000_000);
    expect(tx.balanceAfter).toBe(888_888_800);
    expect(tx.debitAmount).not.toBe(tx.balanceAfter);
  });

  it("Kuda keeps a single-amount row's amount and leaves the balance absent", () => {
    const tx = kuda(["10/08/26", "", "50,000.00", "outward transfer", "JOHN DOE"]);
    expect(tx.debitAmount).toBe(5_000_000);
    expect(tx.creditAmount).toBeUndefined();
    expect(tx.balanceAfter).toBeUndefined();
  });
});

describe("8F — charges are never ordinary expenses", () => {
  it("splits transfer fees, VAT, SMS and bank charges into their own kinds + types", () => {
    const cases: Array<[string, NormalizedBankTransaction["type"], NormalizedBankTransaction["txType"]]> = [
      ["Commission on NIP Transfer CHARGES", "bank-fee", "transfer-fee"],
      ["VAT on Transfer Fee", "tax", "vat"],
      ["STAMP DUTY", "tax", "stamp-duty"],
      ["SMS ALERT CHARGE", "bank-fee", "sms-charge"],
      ["USSD Charge", "bank-fee", "bank-charge"],
      ["Card maintenance fee", "bank-fee", "bank-charge"],
    ];
    for (const [description, kind, txType] of cases) {
      const tx = gtco([
        "12/08/2026",
        "12/08/2026",
        "GT-REF-00X",
        "4.00",
        "",
        "1,000.00",
        "",
        description,
      ]);
      expect(tx.type, description).toBe(kind);
      expect(tx.txType, description).toBe(txType);
      expect(tx.categoryId).toBeNull();
    }
  });
});

describe("8F — ambiguities the statements do not resolve", () => {
  it("Kuda 'local funds transfer' could be a salary — it stays a transfer, never income", () => {
    const tx = kuda(["10/08/26", "2,925.00", "", "local funds transfer", "Sporty Internet Ltd", "2,939.33"]);
    expect(tx.type).toBe("transfer");
    expect(tx.txType).toBe("transfer");
  });

  it("Kuda 'bank charges' cannot separate VAT from SMS — it stays a generic bank charge", () => {
    const tx = kuda(["12/08/26", "", "4.00", "bank charges", "", "Bank charges", "1,000.00"]);
    expect(tx.type).toBe("bank-fee");
    expect(tx.txType).toBe("bank-charge");
  });

  it("an unreadable narration stays unknown and flagged for review, on every bank", () => {
    for (const tx of [
      gtco(["12/08/2026", "12/08/2026", "GT-REF-008", "500.00", "", "2,000.00", "", "QWE786JSALARYXQWERTY"]),
      opay([
        "2026-08-12 09:00:00",
        "2026-08-12",
        "QWE786JSALARYXQWERTY",
        "₦500.00",
        "",
        "₦2,000.00",
        "OPay App",
        "OP-REF-008",
      ]),
      kuda(["12/08/26", "", "500.00", "outward", "QWE786JSALARYXQWERTY", "2,000.00"]),
    ]) {
      expect(tx.type).toBe("unknown");
      expect(tx.txType).toBe("unknown");
      expect(tx.categoryId).toBeNull();
      expect(tx.needsReview).toBe(true);
    }
  });
});

describe("checkAmountSanity — normalized-layer integrity gate", () => {
  it("accepts single-sided rows and large well-formed amounts", () => {
    expect(checkAmountSanity({ debitAmount: 50_000_000, balanceAfter: 120_000_000 })).toEqual({ ok: true });
    expect(checkAmountSanity({ creditAmount: 260_701_020_100_000 })).toEqual({ ok: true });
  });

  it("rejects a row carrying both a debit and a credit for single-sided banks", () => {
    expect(
      checkAmountSanity(
        { debitAmount: 50_000_000, creditAmount: 120_000_000 },
        { singleSided: true },
      ),
    ).toEqual({ ok: false, reason: "conflicting debit and credit" });
  });

  it("allows both sides when not single-sided (dual-column banks)", () => {
    expect(
      checkAmountSanity(
        { debitAmount: 50_000_000, creditAmount: 120_000_000 },
        { singleSided: false },
      ),
    ).toEqual({ ok: true });
  });

  it("rejects non-finite and negative amounts", () => {
    expect(checkAmountSanity({ debitAmount: NaN })).toEqual({ ok: false, reason: "invalid amount" });
    expect(checkAmountSanity({ creditAmount: -1 })).toEqual({ ok: false, reason: "invalid amount" });
    expect(checkAmountSanity({ balanceAfter: Number.POSITIVE_INFINITY })).toEqual({
      ok: false,
      reason: "invalid amount",
    });
  });
});
