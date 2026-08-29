// Statement-vs-ledger duplicate identity (Prompt 5B).
import { describe, expect, it } from "vitest";
import {
  DUPLICATE_SIGNALS,
  findCounterpartTransfer,
  matchExistingTransaction,
  TRANSFER_COUNTERPART_WINDOW_DAYS,
  type IdentityRow,
  type LedgerTransactionSlice,
} from "../statementIdentity";

function row(patch: Partial<IdentityRow> = {}): IdentityRow {
  return {
    transactionDate: "2026-08-01",
    description: "RENT PAYMENT",
    debitAmount: 50_000_000,
    sourceBank: "opay",
    ...patch,
  };
}

function ledgerTx(
  patch: Partial<LedgerTransactionSlice> = {},
): LedgerTransactionSlice {
  return {
    id: "ledger-1",
    amount: 50_000_000,
    type: "expense",
    date: "2026-08-01",
    note: "RENT PAYMENT",
    ...patch,
  };
}

describe("matchExistingTransaction — confirmed duplicates", () => {
  it("exact duplicate: same details (amount + date + description) is already imported", () => {
    const match = matchExistingTransaction(row(), [ledgerTx()]);
    expect(match.status).toBe("already-imported");
    expect(match.signal).toBe(DUPLICATE_SIGNALS.SAME_DETAILS);
    expect(match.matchedTransactionId).toBe("ledger-1");
  });

  it("exact duplicate: same bank reference is already imported", () => {
    const match = matchExistingTransaction(
      row({ reference: "OP-001" }),
      [ledgerTx({ importSource: { source: "statement-import", bank: "opay", reference: "OP-001" } })],
    );
    expect(match.status).toBe("already-imported");
    expect(match.signal).toBe(DUPLICATE_SIGNALS.SAME_REFERENCE);
  });

  it("normalizes references and descriptions before comparing", () => {
    const match = matchExistingTransaction(
      row({ reference: "op-001 ", description: "  rent   payment " }),
      [ledgerTx({ importSource: { source: "statement-import", bank: "opay", reference: "OP-001" } })],
    );
    expect(match.status).toBe("already-imported");

    const byDetails = matchExistingTransaction(
      row({ description: "  RENT  PAYMENT  " }),
      [ledgerTx({ note: "rent payment" })],
    );
    expect(byDetails.status).toBe("already-imported");
  });

  it("a manual ledger row (no provenance) matches a statement row by details", () => {
    const match = matchExistingTransaction(
      row(),
      [ledgerTx({ importSource: undefined })],
    );
    expect(match.status).toBe("already-imported");
  });
});

describe("matchExistingTransaction — not duplicates", () => {
  it("same amount, different transaction: different date and description is new", () => {
    const match = matchExistingTransaction(
      row({ transactionDate: "2026-08-15", description: "AIRTIME RECHARGE" }),
      [ledgerTx()],
    );
    expect(match.status).toBe("new");
  });

  it("same amount alone never matches", () => {
    const match = matchExistingTransaction(
      row({ transactionDate: "2026-07-01", description: "GROCERIES" }),
      [ledgerTx()],
    );
    expect(match.status).toBe("new");
  });

  it("same date and amount, different reference: a different transaction (new)", () => {
    const match = matchExistingTransaction(
      row({ reference: "OP-999" }),
      [ledgerTx({ importSource: { source: "statement-import", bank: "opay", reference: "OP-001" } })],
    );
    expect(match.status).toBe("new");
  });

  it("different bank, same reference: not the same transaction", () => {
    const match = matchExistingTransaction(
      row({ reference: "OP-001", sourceBank: "gtco" }),
      [ledgerTx({ importSource: { source: "statement-import", bank: "opay", reference: "OP-001" } })],
    );
    expect(match.status).toBe("new");
  });

  it("opposite direction, same amount and date: new", () => {
    const match = matchExistingTransaction(
      row({ creditAmount: 50_000_000, debitAmount: undefined }),
      [ledgerTx()],
    );
    expect(match.status).toBe("new");
  });

  it("a referenced ledger row is matched only by its reference — a reference-less row with matching details is new", () => {
    const match = matchExistingTransaction(
      row(),
      [ledgerTx({ importSource: { source: "statement-import", bank: "opay", reference: "OP-001" } })],
    );
    expect(match.status).toBe("new");
  });
});

describe("matchExistingTransaction — possible duplicates (user decides)", () => {
  it("same date and amount, different description: possible duplicate", () => {
    const match = matchExistingTransaction(
      row({ description: "MYSTERY CHARGE X7" }),
      [ledgerTx({ note: "RENT PAYMENT" })],
    );
    expect(match.status).toBe("possible-duplicate");
    expect(match.signal).toBe(DUPLICATE_SIGNALS.SAME_DATE_AND_AMOUNT);
  });

  it("same description and amount, different date: possible duplicate", () => {
    const match = matchExistingTransaction(
      row({ transactionDate: "2026-08-08" }),
      [ledgerTx()],
    );
    expect(match.status).toBe("possible-duplicate");
    expect(match.signal).toBe(DUPLICATE_SIGNALS.SAME_DESCRIPTION_AND_AMOUNT);
  });

  it("same date and amount with a missing description: possible duplicate", () => {
    const match = matchExistingTransaction(
      row({ description: "" }),
      [ledgerTx({ note: undefined })],
    );
    expect(match.status).toBe("possible-duplicate");
    expect(match.signal).toBe(DUPLICATE_SIGNALS.SAME_DATE_AND_AMOUNT);
  });

  it("a confirmed match beats a possible one from an earlier row", () => {
    const match = matchExistingTransaction(
      row(),
      [
        ledgerTx({ id: "manual-rent", note: "RENT PAID CASH" }),
        ledgerTx({ id: "exact-rent" }),
      ],
    );
    expect(match.status).toBe("already-imported");
    expect(match.matchedTransactionId).toBe("exact-rent");
  });
});

describe("matchExistingTransaction — repeated and partial statement imports", () => {
  const statementRows = [
    row({ transactionDate: "2026-08-01", description: "RENT PAYMENT", debitAmount: 50_000_000 }),
    row({ transactionDate: "2026-08-03", description: "SALARY PAYMENT", creditAmount: 90_000_000, debitAmount: undefined }),
    row({ transactionDate: "2026-08-04", description: "MYSTERY CHARGE X7", debitAmount: 1_200_000 }),
  ];

  it("first import of a statement: everything is new", () => {
    for (const tx of statementRows) {
      expect(matchExistingTransaction(tx, []).status).toBe("new");
    }
  });

  it("repeated statement import: everything is already imported", () => {
    const ledger = statementRows.map((tx, index) =>
      ledgerTx({
        id: `ledger-${index}`,
        amount: tx.debitAmount ?? tx.creditAmount ?? 0,
        type: tx.debitAmount !== undefined ? "expense" : "income",
        date: tx.transactionDate ?? "",
        note: tx.description,
      }),
    );
    for (const tx of statementRows) {
      expect(matchExistingTransaction(tx, ledger).status).toBe("already-imported");
    }
  });

  it("partial previous import: only the previously imported rows match", () => {
    const ledger = [
      ledgerTx({
        id: "ledger-rent",
        amount: 50_000_000,
        date: "2026-08-01",
        note: "RENT PAYMENT",
      }),
    ];
    const statuses = statementRows.map((tx) => matchExistingTransaction(tx, ledger).status);
    expect(statuses).toEqual(["already-imported", "new", "new"]);
  });
});

describe("matchExistingTransaction — duplicate internal transfers", () => {
  it("internal-transfer rows are never falsely matched by amount alone", () => {
    const transferRow = row({
      transactionDate: "2026-08-02",
      description: "TRANSFER TO JOHN DOE",
      debitAmount: 50_000_000,
    });
    const match = matchExistingTransaction(transferRow, [ledgerTx()]);
    expect(match.status).toBe("new");
  });

  it("an internal transfer with identical details to a manual ledger row is flagged, but movements are never imported", () => {
    const transferRow = row({
      transactionDate: "2026-08-01",
      description: "RENT PAYMENT",
      debitAmount: 50_000_000,
    });
    const match = matchExistingTransaction(transferRow, [ledgerTx()]);
    expect(match.status).toBe("already-imported");
  });
});

describe("matchExistingTransaction — Prompt 8H conservative duplicate strategy", () => {
  it("two same-day same-amount transactions with different descriptions are NEVER confirmed duplicates", () => {
    const match = matchExistingTransaction(
      row({ debitAmount: 100_000, description: "MTN DATA" }),
      [ledgerTx({ amount: 100_000, note: "TRANSPORT" })],
    );
    expect(match.status).toBe("possible-duplicate");
    expect(match.status).not.toBe("already-imported");
  });

  it("two identical reference-less transactions merge only on FULL details", () => {
    const byDetails = matchExistingTransaction(
      row({ debitAmount: 100_000, description: "AIRTIME" }),
      [ledgerTx({ amount: 100_000, note: "AIRTIME" })],
    );
    expect(byDetails.status).toBe("already-imported");

    const notConfirmed = matchExistingTransaction(
      row({ debitAmount: 100_000, description: "AIRTIME" }),
      [ledgerTx({ amount: 100_000, note: "TRANSPORT" })],
    );
    expect(notConfirmed.status).toBe("possible-duplicate");
  });

  it("duplicate refunds: the same refund re-imported is already imported — by reference and by details", () => {
    const refund = row({
      creditAmount: 20_000_000,
      debitAmount: undefined,
      description: "REFUND FROM SHOPRITE",
      transactionDate: "2026-08-10",
    });

    const byReference = matchExistingTransaction(
      { ...refund, reference: "OP-RF-001" },
      [
        ledgerTx({
          amount: 20_000_000,
          type: "income",
          date: "2026-08-10",
          importSource: { source: "statement-import", bank: "opay", reference: "OP-RF-001" },
        }),
      ],
    );
    expect(byReference.status).toBe("already-imported");
    expect(byReference.signal).toBe(DUPLICATE_SIGNALS.SAME_REFERENCE);

    const byDetails = matchExistingTransaction(refund, [
      ledgerTx({ amount: 20_000_000, type: "income", date: "2026-08-10", note: "REFUND FROM SHOPRITE" }),
    ]);
    expect(byDetails.status).toBe("already-imported");
    expect(byDetails.signal).toBe(DUPLICATE_SIGNALS.SAME_DETAILS);
  });

  it("distinct refunds (same amount, different reference/date) are never merged", () => {
    const match = matchExistingTransaction(
      row({
        creditAmount: 20_000_000,
        debitAmount: undefined,
        description: "REFUND FROM SHOPRITE",
        transactionDate: "2026-08-20",
        reference: "OP-RF-002",
      }),
      [
        ledgerTx({
          amount: 20_000_000,
          type: "income",
          date: "2026-08-10",
          importSource: { source: "statement-import", bank: "opay", reference: "OP-RF-001" },
        }),
      ],
    );
    expect(match.status).toBe("new");
  });

  it("duplicate fees are never silently confirmed — amount + date alone is possible, not certain", () => {
    const match = matchExistingTransaction(
      row({ debitAmount: 2_000, description: "SMS ALERT CHARGE" }),
      [ledgerTx({ amount: 2_000, note: "COMMISSION CHARGE" })],
    );
    expect(match.status).toBe("possible-duplicate");
    expect(match.status).not.toBe("already-imported");
  });
});

describe("findCounterpartTransfer — own-account pairs across statements", () => {
  it("flags a same-amount debit whose other side arrived in the ledger as income", () => {
    const match = findCounterpartTransfer(
      row({
        transactionDate: "2026-08-05",
        debitAmount: 1_200_000,
        creditAmount: undefined,
        description: "MYSTERY SWEEP",
      }),
      [
        ledgerTx({
          id: "ledger-in",
          amount: 1_200_000,
          type: "income",
          date: "2026-08-04",
          note: "TRANSFER FROM MYSTERY",
        }),
      ],
    );
    expect(match).not.toBeNull();
    expect(match!.ledgerType).toBe("income");
    expect(match!.daysApart).toBe(1);
    expect(match!.ledgerId).toBe("ledger-in");
  });

  it("flags a same-amount credit whose other side left the ledger as an expense", () => {
    const match = findCounterpartTransfer(
      row({
        transactionDate: "2026-08-05",
        creditAmount: 500_000,
        debitAmount: undefined,
      }),
      [
        ledgerTx({
          id: "ledger-out",
          amount: 500_000,
          type: "expense",
          date: "2026-08-05",
          note: "INTERNAL TO BANK",
        }),
      ],
    );
    expect(match?.ledgerType).toBe("expense");
    expect(match?.daysApart).toBe(0);
  });

  it("never flags a genuine external transaction — different amount", () => {
    const match = findCounterpartTransfer(
      row({ transactionDate: "2026-08-05" }), // 50_000_000 debit
      [ledgerTx({ amount: 5_000_000, type: "income", date: "2026-08-05" })],
    );
    expect(match).toBeNull();
  });

  it("never pairs a ledger entry on the SAME side — a coincidental same amount", () => {
    // An expense of the same amount in the ledger is not the income side of
    // a transfer; it is just another spend.
    const match = findCounterpartTransfer(
      row({ transactionDate: "2026-08-05" }), // debit 50_000_000
      [ledgerTx({ amount: 50_000_000, type: "expense", date: "2026-08-05" })],
    );
    expect(match).toBeNull();
  });

  it(`does not reach entries outside the ${TRANSFER_COUNTERPART_WINDOW_DAYS}-day window`, () => {
    const match = findCounterpartTransfer(
      row({ transactionDate: "2026-08-05" }),
      [ledgerTx({ amount: 50_000_000, type: "income", date: "2026-08-08" })], // 3 days
    );
    expect(match).toBeNull();
  });

  it("picks the closest of several candidates, then the lowest ledger id", () => {
    const match = findCounterpartTransfer(
      row({ transactionDate: "2026-08-05" }),
      [
        ledgerTx({ id: "b", amount: 50_000_000, type: "income", date: "2026-08-06" }),
        ledgerTx({ id: "a", amount: 50_000_000, type: "income", date: "2026-08-06" }),
      ],
    );
    expect(match?.ledgerId).toBe("a");
  });

  it("returns null for a row without a readable date", () => {
    expect(
      findCounterpartTransfer(row({ transactionDate: null }), [
        ledgerTx({ amount: 50_000_000, type: "income", date: "2026-08-01" }),
      ]),
    ).toBeNull();
  });
});
