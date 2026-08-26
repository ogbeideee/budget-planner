import { beforeEach, describe, expect, it } from "vitest";

import {
  detectRelationships,
  isMoneyMovement,
  RELATIONSHIP_SIGNALS,
} from "../statementRelations";
import type { NormalizedBankTransaction } from "../statementTypes";

let counter = 0;

beforeEach(() => {
  counter = 0;
});

function tx(overrides: Partial<NormalizedBankTransaction> = {}): NormalizedBankTransaction {
  counter += 1;
  return {
    id: `t${counter}`,
    transactionDate: "2026-08-12",
    description: "",
    currency: "NGN",
    sourceBank: "opay",
    type: "unknown",
    direction: "out",
    confidence: "none",
    status: "draft",
    categoryId: null,
    row: counter,
    ...overrides,
  };
}

/** debit row factory (direction out, debit amount set). */
function debit(
  description: string,
  amount: number,
  overrides: Partial<NormalizedBankTransaction> = {},
) {
  return tx({ description, debitAmount: amount, direction: "out", ...overrides });
}

/** credit row factory (direction in, credit amount set). */
function credit(
  description: string,
  amount: number,
  overrides: Partial<NormalizedBankTransaction> = {},
) {
  return tx({ description, creditAmount: amount, direction: "in", ...overrides });
}

describe("duplicate detection", () => {
  it("never flags identical amounts as duplicates", () => {
    const report = detectRelationships([
      debit("AIRTIME MTN", 1_000, { reference: "REF-001" }),
      debit("AIRTIME MTN", 1_000, { reference: "REF-002" }),
      debit("RENT", 500_000, { reference: "REF-003" }),
    ]);
    expect(report.duplicates).toEqual([]);
  });

  it("identical fee rows with distinct references stay separate (two fees are not one)", () => {
    const report = detectRelationships([
      debit("SMS ALERT CHARGE", 2_000, { reference: "REF-FEE-1", type: "bank-fee" }),
      debit("SMS ALERT CHARGE", 2_000, { reference: "REF-FEE-2", type: "bank-fee" }),
    ]);
    expect(report.duplicates).toEqual([]);
  });

  it("true fee duplicates (same reference) form a duplicate group", () => {
    const report = detectRelationships([
      debit("SMS ALERT CHARGE", 2_000, { reference: "REF-FEE-1", type: "bank-fee" }),
      debit("SMS ALERT CHARGE", 2_000, { reference: "REF-FEE-1", type: "bank-fee" }),
    ]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0].ids).toHaveLength(2);
    expect(report.duplicates[0].confidence).toBe("high");
  });

  it("flags true duplicates by reference, amount and direction", () => {
    const report = detectRelationships([
      debit("Transfer to JOHN DOE | OPay", 25_000, {
        reference: "GT-REF-100",
        transactionTime: "09:12:00",
        type: "transfer",
      }),
      debit("Transfer to JOHN DOE | OPay", 25_000, {
        reference: "GT-REF-100",
        transactionTime: "09:12:00",
        type: "transfer",
      }),
      credit("SALARY", 500_000, { reference: "GT-REF-200", type: "income" }),
    ]);
    expect(report.duplicates).toHaveLength(1);
    const [group] = report.duplicates;
    expect(group.ids).toHaveLength(2);
    expect(group.confidence).toBe("high");
    expect(group.signals).toContain(RELATIONSHIP_SIGNALS.SAME_REFERENCE);
    expect(group.signals).toContain(RELATIONSHIP_SIGNALS.SAME_AMOUNT);
    expect(group.signals).toContain(RELATIONSHIP_SIGNALS.SAME_DIRECTION);
    expect(group.ids).not.toContain("t3");
  });

  it("flags duplicates without references when every signal matches", () => {
    const report = detectRelationships([
      debit("NIP TRANSFER TO PALMPAY", 50_000, { transactionTime: "10:00:00" }),
      debit("NIP TRANSFER TO PALMPAY", 50_000, { transactionTime: "10:00:00" }),
    ]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0].confidence).toBe("high");
    expect(report.duplicates[0].signals).toEqual(
      expect.arrayContaining([
        RELATIONSHIP_SIGNALS.SAME_DATE,
        RELATIONSHIP_SIGNALS.SAME_TIME,
        RELATIONSHIP_SIGNALS.SAME_AMOUNT,
        RELATIONSHIP_SIGNALS.SAME_DIRECTION,
        RELATIONSHIP_SIGNALS.SAME_DESCRIPTION,
      ]),
    );
  });

  it("flags reference-less duplicates at medium confidence when both times are missing", () => {
    const report = detectRelationships([
      debit("SMS ALERT CHARGE", 400, { transactionTime: undefined }),
      debit("SMS ALERT CHARGE", 400, { transactionTime: undefined }),
    ]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0].confidence).toBe("medium");
  });

  it("treats same-day repeated payments with distinct timestamps as legitimate", () => {
    const report = detectRelationships([
      debit("Transfer to JOHN DOE | OPay", 10_000, { transactionTime: "10:00:00" }),
      debit("Transfer to JOHN DOE | OPay", 10_000, { transactionTime: "12:30:00" }),
    ]);
    expect(report.duplicates).toEqual([]);
  });

  it("does not flag rows with different descriptions but matching amounts and times", () => {
    const report = detectRelationships([
      debit("Transfer to DAVID | OPay", 5_000, { transactionTime: "10:00:00" }),
      debit("Airtime Purchase MTN", 5_000, { transactionTime: "10:00:00" }),
    ]);
    expect(report.duplicates).toEqual([]);
  });

  it("does not flag rows with different references even when otherwise identical", () => {
    const report = detectRelationships([
      debit("AIRTIME MTN", 1_000, { reference: "REF-A", transactionTime: "10:00:00" }),
      debit("AIRTIME MTN", 1_000, { reference: "REF-B", transactionTime: "10:00:00" }),
    ]);
    expect(report.duplicates).toEqual([]);
  });

  it("merges three identical rows into one duplicate group", () => {
    const report = detectRelationships([
      debit("SMS ALERT CHARGE", 400, { transactionTime: "09:00:00" }),
      debit("SMS ALERT CHARGE", 400, { transactionTime: "09:00:00" }),
      debit("SMS ALERT CHARGE", 400, { transactionTime: "09:00:00" }),
    ]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0].ids).toHaveLength(3);
  });

  it("keeps rows with empty descriptions apart when references are missing", () => {
    const report = detectRelationships([
      debit("", 2_000, { transactionTime: "09:00:00" }),
      debit("", 2_000, { transactionTime: "09:00:00" }),
    ]);
    expect(report.duplicates).toEqual([]);
  });

  it("groups ids in statement row order", () => {
    const report = detectRelationships([
      debit("SMS ALERT CHARGE", 400, { transactionTime: "09:00:00" }),
      debit("SALARY", 900_000, { transactionTime: "09:00:00" }),
      debit("SMS ALERT CHARGE", 400, { transactionTime: "09:00:00" }),
    ]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0].ids).toEqual(["t1", "t3"]);
  });
});

describe("linked transactions", () => {
  it("links a transfer followed by an OWealth withdrawal funding it", () => {
    const report = detectRelationships([
      debit("Transfer to DAVID OSAHON OGBEIDE | PalmPay", 50_000, {
        type: "transfer",
        provider: "PalmPay",
      }),
      debit("OWealth Withdrawal (Transaction Payment)", 50_000, {
        type: "internal-transfer",
        provider: "OPay",
      }),
    ]);
    expect(report.links).toHaveLength(1);
    const [link] = report.links;
    expect(link.kind).toBe("funding-pair");
    expect(link.confidence).toBe("high");
    expect(link.fromId).toBe("t1");
    expect(link.toId).toBe("t2");
    expect(link.signals).toContain(RELATIONSHIP_SIGNALS.SAME_AMOUNT);
    expect(link.signals).toContain(RELATIONSHIP_SIGNALS.SAME_DIRECTION);
    expect(link.signals).toContain(RELATIONSHIP_SIGNALS.SAME_DATE);
  });

  it("links a funding pair at medium confidence when the dates differ", () => {
    const report = detectRelationships([
      debit("OWealth Withdrawal (Transaction Payment)", 50_000, {
        type: "internal-transfer",
        transactionDate: "2026-08-11",
      }),
      debit("Transfer to DAVID OSAHON OGBEIDE | PalmPay", 50_000, {
        type: "transfer",
        transactionDate: "2026-08-12",
      }),
    ]);
    expect(report.links).toHaveLength(1);
    expect(report.links[0].confidence).toBe("medium");
    expect(report.links[0].signals).not.toContain(RELATIONSHIP_SIGNALS.SAME_DATE);
  });

  it("does not link a partial savings withdrawal to its auto-save", () => {
    const report = detectRelationships([
      debit("Auto-save to OWealth Balance", 50_000, { type: "savings" }),
      debit("OWealth Withdrawal (Transaction Payment)", 20_000, {
        type: "internal-transfer",
      }),
    ]);
    expect(report.links).toEqual([]);
  });

  it("does not link a movement row to an expense row", () => {
    const report = detectRelationships([
      debit("OWealth Withdrawal (Transaction Payment)", 3_000, {
        type: "internal-transfer",
      }),
      debit("Airtime Purchase MTN", 3_000, { type: "expense" }),
    ]);
    expect(report.links).toEqual([]);
  });

  it("links opposite directions correctly (deposit + transfer in)", () => {
    const report = detectRelationships([
      credit("Transfer from JOHN DOE | OPay", 100_000, { type: "transfer" }),
      credit("OWealth Deposit", 100_000, { type: "internal-transfer" }),
    ]);
    expect(report.links).toHaveLength(1);
    expect(report.links[0].kind).toBe("funding-pair");
  });
});

describe("savings movements", () => {
  it("links an auto-save to a matching OWealth withdrawal of the same amount", () => {
    const report = detectRelationships([
      debit("Auto-save to OWealth Balance", 10_000, { type: "savings" }),
      debit("OWealth Withdrawal (Transaction Payment)", 10_000, {
        type: "internal-transfer",
      }),
    ]);
    expect(report.links).toHaveLength(1);
    expect(report.links[0].kind).toBe("savings-movement");
    expect(report.links[0].confidence).toBe("high");
  });

  it("reports savings and internal-transfer rows as money movement", () => {
    const report = detectRelationships([
      debit("Auto-save to OWealth Balance", 10_000, { type: "savings" }),
      debit("OWealth Withdrawal (Transaction Payment)", 10_000, {
        type: "internal-transfer",
      }),
      debit("Transfer to JOHN DOE | OPay", 5_000, { type: "transfer" }),
    ]);
    expect(report.movementIds).toEqual(["t1", "t2"]);
    expect(isMoneyMovement(tx({ type: "savings" }))).toBe(true);
    expect(isMoneyMovement(tx({ type: "internal-transfer" }))).toBe(true);
    expect(isMoneyMovement(tx({ type: "transfer" }))).toBe(false);
    expect(isMoneyMovement(tx({ type: "expense" }))).toBe(false);
  });

  it("does not create expenses from savings movements", () => {
    const report = detectRelationships([
      debit("Auto-save to OWealth Balance", 10_000, { type: "savings" }),
    ]);
    expect(report.links).toEqual([]);
    expect(report.duplicates).toEqual([]);
    expect(report.movementIds).toEqual(["t1"]);
  });
});

describe("report integrity", () => {
  it("never mutates its input", () => {
    const input = [
      debit("SMS ALERT CHARGE", 400, { transactionTime: "09:00:00" }),
      debit("SMS ALERT CHARGE", 400, { transactionTime: "09:00:00" }),
      debit("Auto-save to OWealth Balance", 10_000, { type: "savings" }),
    ];
    const snapshot = JSON.stringify(input);
    detectRelationships(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("keeps every original transaction available (nothing deleted)", () => {
    const input = [
      debit("Transfer to JOHN DOE | OPay", 25_000, { reference: "REF-X", type: "transfer" }),
      debit("Transfer to JOHN DOE | OPay", 25_000, { reference: "REF-X", type: "transfer" }),
    ];
    const report = detectRelationships(input);
    expect(report.duplicates.flatMap((group) => group.ids).sort()).toEqual([
      "t1",
      "t2",
    ]);
  });
});