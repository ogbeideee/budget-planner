import { describe, expect, it } from "vitest";
import {
  budgetHealth,
  budgetProgress,
  budgetUtilizationSeries,
  deferredExpenses,
  earned,
  healthTier,
  monthlySeries,
  needsFunding,
  overBudgetCategories,
  sortByDateDesc,
  sortTransactions,
  spendingByCategory,
  spendingByCategoryInMonths,
  spent,
  totals,
  transactionsForMonth,
  windowMonths,
} from "../selectors";
import type { Budget, Category, Transaction } from "../types";

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    categoryId: "cat-exp",
    amount: 100,
    type: "expense",
    date: "2026-08-10",
    createdAt: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
}

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe("spent / earned / totals", () => {
  it("sums expenses per category and month", () => {
    const transactions = [
      txn({ id: "a", categoryId: "cat-exp", amount: 500, date: "2026-08-03" }),
      txn({ id: "b", categoryId: "cat-exp", amount: 250, date: "2026-08-20" }),
      txn({ id: "c", categoryId: "cat-other", amount: 100, date: "2026-08-03" }),
      txn({ id: "d", categoryId: "cat-exp", amount: 999, date: "2026-07-03" }),
    ];
    expect(spent(transactions, "cat-exp", "2026-08")).toBe(750);
    expect(spent(transactions, "cat-other", "2026-08")).toBe(100);
    expect(earned(transactions, "cat-exp", "2026-08")).toBe(0);
  });

  it("computes income and expenses for a month", () => {
    const transactions = [
      txn({ id: "a", type: "income", amount: 200000 }),
      txn({ id: "b", amount: 50000 }),
      txn({ id: "c", type: "income", amount: 10000, date: "2026-07-01" }),
    ];
    const result = totals(transactions, "2026-08");
    expect(result.income).toBe(200000);
    expect(result.expenses).toBe(50000);
    expect(result.net).toBe(150000);
  });

  it("net equals income minus expenses for 100 random transactions (AC-12)", () => {
    const random = seeded(42);
    const categories = ["cat-a", "cat-b", "cat-c"];
    const transactions = Array.from({ length: 100 }, (_, index) =>
      txn({
        id: `t${index}`,
        categoryId: categories[Math.floor(random() * categories.length)],
        type: random() > 0.5 ? "income" : "expense",
        amount: Math.floor(random() * 100000) + 1,
        date: random() > 0.2 ? "2026-08-01" : "2026-07-01",
      }),
    );
    const { income, expenses, net } = totals(transactions, "2026-08");
    expect(net).toBe(income - expenses);
  });
});

describe("transactionsForMonth / sortByDateDesc", () => {
  it("filters and sorts by date descending", () => {
    const transactions = [
      txn({ id: "a", date: "2026-08-03" }),
      txn({ id: "b", date: "2026-07-03" }),
      txn({ id: "c", date: "2026-08-20" }),
    ];
    expect(transactionsForMonth(transactions, "2026-08").map((t) => t.id)).toEqual([
      "a",
      "c",
    ]);
    expect(sortByDateDesc(transactions).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });
});

describe("budgetProgress", () => {
  const budget: Budget = {
    id: "b1",
    categoryId: "cat-exp",
    month: "2026-08",
    limit: 1000,
    priority: "medium",
  };

  it("reports progress capped at 1 and over when spent exceeds limit", () => {
    const under = budgetProgress(budget, [txn({ amount: 500, date: "2026-08-01" })]);
    expect(under.progress).toBe(0.5);
    expect(under.over).toBe(false);
    expect(under.remaining).toBe(500);

    const over = budgetProgress(budget, [
      txn({ amount: 1300, date: "2026-08-01" }),
    ]);
    expect(over.progress).toBe(1);
    expect(over.over).toBe(true);
    expect(over.remaining).toBe(-300);
  });

  it("has zero progress for a zero limit", () => {
    const zeroLimit: Budget = { ...budget, limit: 0 };
    const result = budgetProgress(zeroLimit, [txn({ amount: 500, date: "2026-08-01" })]);
    expect(result.progress).toBe(0);
    expect(result.over).toBe(true);
  });

  it("ignores transactions from other months", () => {
    const result = budgetProgress(budget, [txn({ amount: 999, date: "2026-07-01" })]);
    expect(result.spent).toBe(0);
  });
});

describe("overBudgetCategories", () => {
  it("lists only budgets whose spent exceeds the limit", () => {
    const budgets: Budget[] = [
      { id: "b1", categoryId: "cat-a", month: "2026-08", limit: 1000, priority: "medium" },
      { id: "b2", categoryId: "cat-b", month: "2026-08", limit: 1000, priority: "medium" },
      { id: "b3", categoryId: "cat-c", month: "2026-07", limit: 1, priority: "medium" },
    ];
    const transactions = [
      txn({ id: "a", categoryId: "cat-a", amount: 1500, date: "2026-08-01" }),
      txn({ id: "b", categoryId: "cat-b", amount: 500, date: "2026-08-01" }),
    ];
    const result = overBudgetCategories(budgets, transactions, "2026-08");
    expect(result.map((entry) => entry.budget.id)).toEqual(["b1"]);
    expect(result[0].spent).toBe(1500);
  });
});

describe("spendingByCategory", () => {
  it("groups expenses by category and ranks descending", () => {
    const transactions = [
      txn({ id: "a", categoryId: "cat-a", amount: 300, date: "2026-08-01" }),
      txn({ id: "b", categoryId: "cat-b", amount: 500, date: "2026-08-01" }),
      txn({ id: "c", categoryId: "cat-a", amount: 200, date: "2026-08-02" }),
      txn({ id: "d", categoryId: "cat-c", type: "income", amount: 900, date: "2026-08-01" }),
    ];
    expect(spendingByCategory(transactions, "2026-08")).toEqual([
      { categoryId: "cat-a", amount: 500 },
      { categoryId: "cat-b", amount: 500 },
    ]);
  });
});

describe("budgetHealth (AC-19)", () => {
  it("computes the AC-19 example to 75", () => {
    const budgets: Budget[] = [
      { id: "b1", categoryId: "cat-a", month: "2026-08", limit: 40000, priority: "medium" },
    ];
    const transactions = [
      txn({ id: "inc", type: "income", amount: 100000, date: "2026-08-01" }),
      txn({ id: "exp", categoryId: "cat-a", amount: 50000, date: "2026-08-01" }),
    ];
    expect(budgetHealth(budgets, transactions, "2026-08")).toBe(75);
  });

  it("scores 100 with no overspend and a positive net", () => {
    const budgets: Budget[] = [
      { id: "b1", categoryId: "cat-a", month: "2026-08", limit: 40000, priority: "medium" },
    ];
    const transactions = [
      txn({ id: "inc", type: "income", amount: 100000, date: "2026-08-01" }),
    ];
    expect(budgetHealth(budgets, transactions, "2026-08")).toBe(100);
  });

  it("penalizes a negative net by 15", () => {
    const transactions = [
      txn({ id: "inc", type: "income", amount: 1000, date: "2026-08-01" }),
      txn({ id: "exp", amount: 5000, date: "2026-08-01" }),
    ];
    expect(budgetHealth([], transactions, "2026-08")).toBe(85);
  });

  it("caps the per-budget penalty at 30 and applies the net penalty", () => {
    const budgets: Budget[] = [
      { id: "b1", categoryId: "cat-a", month: "2026-08", limit: 100, priority: "medium" },
    ];
    const transactions = [
      txn({ id: "exp", categoryId: "cat-a", amount: 100000, date: "2026-08-01" }),
    ];
    expect(budgetHealth(budgets, transactions, "2026-08")).toBe(55);
  });
});

describe("healthTier", () => {
  it("maps scores to tiers", () => {
    expect(healthTier(100)).toBe("healthy");
    expect(healthTier(80)).toBe("healthy");
    expect(healthTier(79)).toBe("watch");
    expect(healthTier(50)).toBe("watch");
    expect(healthTier(49)).toBe("risk");
    expect(healthTier(0)).toBe("risk");
  });
});

describe("deferredExpenses (AC-24)", () => {
  it("returns only deferred expense transactions in the month", () => {
    const transactions = [
      txn({ id: "a", deferred: true, amount: 500, date: "2026-08-15" }),
      txn({ id: "b", amount: 300, date: "2026-08-20" }),
      txn({
        id: "c",
        deferred: true,
        type: "income",
        categoryId: "cat-inc",
        amount: 900,
        date: "2026-08-05",
      }),
      txn({ id: "d", deferred: true, amount: 200, date: "2026-09-01" }),
    ];
    const result = deferredExpenses(transactions, "2026-08");
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("returns an empty list when nothing was deferred", () => {
    expect(
      deferredExpenses([txn({ amount: 100 })], "2026-08"),
    ).toEqual([]);
  });
});

describe("sortTransactions", () => {
  const list = [
    txn({ id: "a", date: "2026-08-10", amount: 1000 }),
    txn({ id: "b", date: "2026-08-01", amount: 500 }),
    txn({ id: "c", date: "2026-08-15", amount: 2000 }),
    txn({ id: "d", date: "2026-08-01", amount: 300 }),
  ];

  it("sorts by date descending by default (newest first)", () => {
    expect(sortByDateDesc(list).map((t) => t.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("sorts by date ascending (oldest first)", () => {
    expect(
      sortTransactions(list, { key: "date", direction: "asc" }).map((t) => t.id),
    ).toEqual(["b", "d", "a", "c"]);
  });

  it("sorts by amount high to low", () => {
    expect(
      sortTransactions(list, { key: "amount", direction: "desc" }).map((t) => t.id),
    ).toEqual(["c", "a", "b", "d"]);
  });

  it("sorts by amount low to high", () => {
    expect(
      sortTransactions(list, { key: "amount", direction: "asc" }).map((t) => t.id),
    ).toEqual(["d", "b", "a", "c"]);
  });

  it("is stable: equal keys fall back to id order", () => {
    expect(
      sortTransactions(list, { key: "date", direction: "asc" }).map((t) => t.id),
    ).toEqual(["b", "d", "a", "c"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...list];
    sortTransactions(list, { key: "amount", direction: "asc" });
    expect(list).toEqual(copy);
  });
});

describe("needsFunding (AC-25)", () => {
  function category(id: string, name: string, kind: "income" | "expense"): Category {
    return {
      id,
      name,
      icon: "•",
      color: "#000000",
      kind,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
  }

  const categories = [
    category("cat-rent", "Rent", "expense"),
    category("cat-food", "Food", "expense"),
    category("cat-salary", "Salary", "income"),
  ];

  function budget(categoryId: string, limit: number, month = "2026-08"): Budget {
    return {
      id: `b-${categoryId}`,
      categoryId,
      month,
      limit,
      priority: "medium",
    };
  }

  it("lists expense categories with no budget for the month", () => {
    const result = needsFunding(
      [budget("cat-rent", 1000)],
      categories,
      "2026-08",
    );
    expect(result.map((c) => c.id)).toEqual(["cat-food"]);
  });

  it("includes categories whose budget limit is 0", () => {
    const result = needsFunding(
      [budget("cat-rent", 0), budget("cat-food", 1500)],
      categories,
      "2026-08",
    );
    expect(result.map((c) => c.id)).toEqual(["cat-rent"]);
  });

  it("excludes income categories and funded categories", () => {
    const result = needsFunding(
      [budget("cat-rent", 1000), budget("cat-food", 1500)],
      categories,
      "2026-08",
    );
    expect(result).toEqual([]);
  });

  it("ignores budgets from other months", () => {
    const result = needsFunding(
      [budget("cat-rent", 1000, "2026-07")],
      categories,
      "2026-08",
    );
    expect(result.map((c) => c.id)).toEqual(["cat-food", "cat-rent"]);
  });

  it("sorts by name deterministically", () => {
    const result = needsFunding([], categories, "2026-08");
    expect(result.map((c) => c.id)).toEqual(["cat-food", "cat-rent"]);
  });
});

describe("reports selectors (FR-07)", () => {
  it("windowMonths returns count months ending at the given month, in order", () => {
    expect(windowMonths("2026-08")).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(windowMonths("2026-08", 3)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("monthlySeries computes income, expenses and net per month", () => {
    const transactions = [
      txn({ id: "a", type: "income", amount: 200000, date: "2026-07-01" }),
      txn({ id: "b", amount: 50000, date: "2026-07-15" }),
      txn({ id: "c", type: "income", amount: 200000, date: "2026-08-01" }),
      txn({ id: "d", amount: 30000, date: "2026-08-10" }),
      txn({ id: "e", amount: 1000, date: "2026-06-01" }),
    ];
    const series = monthlySeries(transactions, windowMonths("2026-08", 3));
    expect(series.map((point) => point.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(series[0].expenses).toBe(1000);
    expect(series[0].income).toBe(0);
    expect(series[1]).toMatchObject({ income: 200000, expenses: 50000, net: 150000 });
    expect(series[2]).toMatchObject({ income: 200000, expenses: 30000, net: 170000 });
  });

  it("budgetUtilizationSeries aggregates limits and spent per month, skipping months without budgets", () => {
    const budgets = [
      { id: "b1", categoryId: "cat-a", month: "2026-07", limit: 100000, priority: "high" as const },
      { id: "b2", categoryId: "cat-b", month: "2026-07", limit: 50000, priority: "medium" as const },
      { id: "b3", categoryId: "cat-a", month: "2026-08", limit: 0, priority: "low" as const },
    ];
    const transactions = [
      txn({ id: "t1", categoryId: "cat-a", amount: 40000, date: "2026-07-03" }),
      txn({ id: "t2", categoryId: "cat-b", amount: 5000, date: "2026-07-10" }),
      txn({ id: "t3", categoryId: "cat-a", amount: 70000, date: "2026-08-03" }),
    ];
    const series = budgetUtilizationSeries(
      budgets,
      transactions,
      windowMonths("2026-08", 3),
    );
    expect(series).toEqual([
      { month: "2026-07", limit: 150000, spentTotal: 45000 },
    ]);
  });

  it("spendingByCategoryInMonths ranks expense categories across a window, excluding income", () => {
    const transactions = [
      txn({ id: "a", categoryId: "cat-a", amount: 30000, date: "2026-07-01" }),
      txn({ id: "b", categoryId: "cat-b", amount: 50000, date: "2026-07-02" }),
      txn({ id: "c", categoryId: "cat-a", amount: 20000, date: "2026-08-01" }),
      txn({ id: "d", categoryId: "cat-c", amount: 10000, date: "2026-09-01" }),
      txn({ id: "e", type: "income", amount: 999999, date: "2026-07-03" }),
    ];
    const result = spendingByCategoryInMonths(transactions, [
      "2026-07",
      "2026-08",
    ]);
    expect(result).toEqual([
      { categoryId: "cat-a", amount: 50000 },
      { categoryId: "cat-b", amount: 50000 },
    ]);
  });
});
