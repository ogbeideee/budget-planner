import { describe, expect, it } from "vitest";
import { insightsFor } from "../insights";
import type { Budget, Category, Transaction } from "../types";

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Groceries",
    icon: "🛒",
    color: "#f97316",
    kind: "expense",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    categoryId: "cat-1",
    amount: 100,
    type: "expense",
    date: "2026-08-10",
    createdAt: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: "b1",
    categoryId: "cat-1",
    month: "2026-08",
    limit: 10000,
    priority: "medium",
    ...overrides,
  };
}

const base = {
  budgets: [] as Budget[],
  transactions: [] as Transaction[],
  categories: [category()],
  month: "2026-08",
  currency: "USD" as const,
};

describe("insightsFor (AC-21)", () => {
  it("returns a single no-data card for an empty month", () => {
    const result = insightsFor(base);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("no-data");
    expect(result[0].tone).toBe("neutral");
  });

  it("reports high-priority overspend first, in danger tone", () => {
    const result = insightsFor({
      ...base,
      budgets: [budget({ priority: "high", limit: 1000 })],
      transactions: [txn({ amount: 2000 })],
    });
    expect(result[0].id).toBe("high-over");
    expect(result[0].tone).toBe("danger");
    expect(result[0].action?.href).toBe("/");
    expect(result[0].detail).toContain("$10.00");
  });

  it("yields at least two deterministic cards for the AC-21 scenario", () => {
    const result = insightsFor({
      ...base,
      budgets: [budget({ priority: "high", limit: 1000 })],
      transactions: [
        txn({ id: "inc", type: "income", amount: 100000 }),
        txn({ id: "exp", amount: 2000 }),
      ],
    });
    expect(result.map((insight) => insight.id)).toEqual(["high-over", "over-120"]);
  });

  it("reports a far-over budget even without high priority", () => {
    const result = insightsFor({
      ...base,
      budgets: [budget({ limit: 1000 })],
      transactions: [txn({ amount: 3000 })],
    });
    expect(result[0].id).toBe("over-120");
    expect(result[0].tone).toBe("danger");
  });

  it("warns when spending exceeds income", () => {
    const result = insightsFor({
      ...base,
      budgets: [],
      transactions: [
        txn({ id: "inc", type: "income", amount: 500 }),
        txn({ id: "exp", amount: 800 }),
      ],
    });
    expect(result[0].id).toBe("net-negative");
    expect(result[0].tone).toBe("warn");
  });

  it("suggests a budget for unallocated income", () => {
    const result = insightsFor({
      ...base,
      budgets: [],
      transactions: [txn({ id: "inc", type: "income", amount: 5000 })],
    });
    expect(result.map((insight) => insight.id)).toEqual(["unallocated"]);
    expect(result[0].action?.href).toBe("/");
  });

  it("notes the top unbudgeted spending category", () => {
    const result = insightsFor({
      ...base,
      budgets: [budget()],
      categories: [
        category(),
        category({ id: "cat-2", name: "Clothing", icon: "👕", color: "#0ea5e9" }),
      ],
      transactions: [
        txn({ id: "inc", type: "income", amount: 5000 }),
        txn({ categoryId: "cat-2", amount: 3000 }),
      ],
    });
    expect(result[0].id).toBe("no-budget");
    expect(result[0].detail).toContain("Clothing");
  });

  it("reports on-track for a high-priority budget under half", () => {
    const result = insightsFor({
      ...base,
      budgets: [budget({ priority: "high", limit: 10000 })],
      transactions: [txn({ amount: 2000 })],
    });
    expect(result[result.length - 1].id).toBe("on-track");
    expect(result[result.length - 1].tone).toBe("success");
  });

  it("formats money in the configured currency", () => {
    const result = insightsFor({
      ...base,
      currency: "NGN",
      budgets: [budget({ priority: "high", limit: 1000 })],
      transactions: [txn({ amount: 2000 })],
    });
    expect(result[0].detail).toContain("₦10.00");
  });
});
