import { describe, expect, it } from "vitest";
import { monthFinance, financeSeries } from "../finance";
import type { IncomePlan, Transaction } from "../types";

function txn(
  type: "income" | "expense",
  amount: number,
  date: string,
): Transaction {
  return {
    id: crypto.randomUUID(),
    categoryId: "cat-1",
    amount,
    type,
    date,
    note: undefined,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function plan(
  month: string,
  expectedAmount: number,
  receivedAmount: number,
): IncomePlan {
  return {
    id: crypto.randomUUID(),
    month,
    name: "Salary",
    icon: "💰",
    expectedAmount,
    receivedAmount,
  };
}

describe("monthFinance", () => {
  it("computes remaining and net from received income, not expected", () => {
    const finance = monthFinance(
      [txn("expense", 175000, "2026-08-05")],
      [plan("2026-08", 350000, 250000)],
      "2026-08",
    );
    expect(finance.received).toBe(250000);
    expect(finance.expected).toBe(350000);
    expect(finance.expenses).toBe(175000);
    expect(finance.remaining).toBe(75000);
    expect(finance.net).toBe(75000);
    expect(finance.projectedRemaining).toBe(175000);
  });

  it("floors received income with ledger transactions when no plans exist", () => {
    const finance = monthFinance(
      [txn("income", 250000, "2026-08-01"), txn("expense", 175000, "2026-08-05")],
      [],
      "2026-08",
    );
    expect(finance.received).toBe(250000);
    expect(finance.net).toBe(75000);
    expect(finance.remaining).toBe(75000);
  });

  it("never double counts income recorded both as a transaction and a plan", () => {
    const finance = monthFinance(
      [txn("income", 250000, "2026-08-01"), txn("expense", 175000, "2026-08-05")],
      [plan("2026-08", 350000, 250000)],
      "2026-08",
    );
    expect(finance.received).toBe(250000);
    expect(finance.net).toBe(75000);
  });

  it("clamps remaining at zero when expenses exceed received income", () => {
    const finance = monthFinance(
      [txn("expense", 300000, "2026-08-05")],
      [plan("2026-08", 350000, 250000)],
      "2026-08",
    );
    expect(finance.net).toBe(-50000);
    expect(finance.remaining).toBe(0);
    expect(finance.projectedRemaining).toBe(50000);
  });

  it("computes the savings rate against received income", () => {
    const finance = monthFinance(
      [txn("expense", 100000, "2026-08-05")],
      [plan("2026-08", 350000, 250000)],
      "2026-08",
    );
    expect(finance.savingsRate).toBe(60);
  });

  it("returns null savings rate without received income", () => {
    const finance = monthFinance([], [], "2026-08");
    expect(finance.savingsRate).toBeNull();
  });
});

describe("financeSeries", () => {
  it("applies the same rules per month", () => {
    const series = financeSeries(
      [txn("expense", 10000, "2026-08-05"), txn("expense", 5000, "2026-09-05")],
      [plan("2026-08", 30000, 25000), plan("2026-09", 20000, 15000)],
      ["2026-08", "2026-09", "2026-10"],
    );
    expect(series[0]).toMatchObject({
      month: "2026-08",
      received: 25000,
      expected: 30000,
      expenses: 10000,
      net: 15000,
      remaining: 15000,
      projectedRemaining: 20000,
    });
    expect(series[1]).toMatchObject({
      month: "2026-09",
      received: 15000,
      expected: 20000,
      expenses: 5000,
      net: 10000,
      projectedRemaining: 15000,
    });
    expect(series[2]).toMatchObject({
      month: "2026-10",
      received: 0,
      expected: 0,
      expenses: 0,
      net: 0,
      remaining: 0,
      projectedRemaining: 0,
    });
  });
});
