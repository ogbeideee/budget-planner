import { describe, expect, it } from "vitest";
import { createInitialState } from "../seed";
import { todoFor } from "../todo";
import type { AppState, Category, Transaction } from "../types";

function expenseCategory(state: AppState): Category {
  return state.categories.find((c) => c.kind === "expense")!;
}

function incomeCategory(state: AppState): Category {
  return state.categories.find((c) => c.kind === "income")!;
}

function withTransaction(
  state: AppState,
  overrides: Partial<Transaction>,
): AppState {
  const category = expenseCategory(state);
  return {
    ...state,
    transactions: [
      {
        id: crypto.randomUUID(),
        categoryId: category.id,
        amount: 1000,
        type: "expense",
        date: "2026-08-10",
        createdAt: "2026-08-10T00:00:00.000Z",
        ...overrides,
      },
      ...state.transactions,
    ],
  };
}

describe("todoFor (AC-23)", () => {
  it("returns a single neutral item for an empty month", () => {
    const items = todoFor(createInitialState(), "2026-08");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("no-data");
    expect(items[0].tone).toBe("neutral");
  });

  it("reports a high-priority budget over its limit with a resolving href", () => {
    const state = createInitialState();
    const category = expenseCategory(state);
    const withBudget = {
      ...state,
      budgets: [
        {
          id: crypto.randomUUID(),
          categoryId: category.id,
          month: "2026-08",
          limit: 1000,
          priority: "high" as const,
        },
      ],
    };
    const withExpense = withTransaction(withBudget, { amount: 1200 });
    const items = todoFor(withExpense, "2026-08");
    expect(items[0]).toMatchObject({
      id: "high-over",
      tone: "danger",
      title: "High-priority budget over",
      href: "/",
    });
    expect(items[0].detail).toContain("$2.00");
  });

  it("lists a spending category without a budget", () => {
    const state = createInitialState();
    const withExpense = withTransaction(state, { amount: 500 });
    const items = todoFor(withExpense, "2026-08");
    const ids = items.map((item) => item.id);
    expect(ids).toContain("no-budget");
  });

  it("lists unallocated funds when net is positive and no budgets exist", () => {
    const state = createInitialState();
    const income = incomeCategory(state);
    const stateWithIncome = {
      ...state,
      transactions: [
        {
          id: crypto.randomUUID(),
          categoryId: income.id,
          amount: 10000,
          type: "income" as const,
          date: "2026-08-01",
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    const items = todoFor(stateWithIncome, "2026-08");
    expect(items.map((item) => item.id)).toContain("unallocated");
  });

  it("lists deferred expenses moved into the month", () => {
    const state = createInitialState();
    const withExpense = withTransaction(state, { deferred: true, amount: 750 });
    const items = todoFor(withExpense, "2026-08");
    const deferred = items.find((item) => item.id === "deferred");
    expect(deferred).toBeDefined();
    expect(deferred?.tone).toBe("warn");
    expect(deferred?.detail).toContain("$7.50");
    expect(deferred?.detail).toContain("1 deferred expense");
  });

  it("omits the deferred item when nothing is deferred", () => {
    const state = createInitialState();
    const withExpense = withTransaction(state, { amount: 500 });
    const items = todoFor(withExpense, "2026-08");
    expect(items.some((item) => item.id === "deferred")).toBe(false);
  });

  it("caps the list at 5 items", () => {
    const state = createInitialState();
    const income = incomeCategory(state);
    const expense = expenseCategory(state);
    const otherExpense = state.categories.find(
      (c) => c.kind === "expense" && c.id !== expense.id,
    )!;
    const stateWithBudget = {
      ...state,
      budgets: [
        {
          id: crypto.randomUUID(),
          categoryId: expense.id,
          month: "2026-08",
          limit: 1000,
          priority: "high" as const,
        },
      ],
    };
    const transactions: Transaction[] = [
      {
        id: crypto.randomUUID(),
        categoryId: expense.id,
        amount: 6000,
        type: "expense",
        date: "2026-08-01",
        createdAt: "2026-08-01T00:00:00.000Z",
        deferred: true,
      },
      {
        id: crypto.randomUUID(),
        categoryId: otherExpense.id,
        amount: 4000,
        type: "expense",
        date: "2026-08-02",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: crypto.randomUUID(),
        categoryId: income.id,
        amount: 3000,
        type: "income",
        date: "2026-08-03",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const items = todoFor(
      { ...stateWithBudget, transactions },
      "2026-08",
    );
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.id)).toEqual([
      "high-over",
      "over-120",
      "net-negative",
      "deferred",
      "no-budget",
    ]);
  });

  it("is deterministic for the same state", () => {
    const state = createInitialState();
    const withExpense = withTransaction(state, { deferred: true, amount: 750 });
    expect(todoFor(withExpense, "2026-08")).toEqual(
      todoFor(withExpense, "2026-08"),
    );
  });
});
