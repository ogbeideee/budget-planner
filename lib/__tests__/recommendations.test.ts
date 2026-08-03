import { describe, expect, it } from "vitest";
import { budgetSuggestions } from "../recommendations";
import { createInitialState } from "../seed";
import type { Budget, Category, Transaction } from "../types";

function setup() {
  const state = createInitialState();
  const expense = state.categories.filter((c) => c.kind === "expense");
  const [rent, groceries, transport] = expense;
  return { state, rent, groceries, transport };
}

function budgetFor(category: Category, limit: number, priority: "high" | "medium" | "low" = "medium"): Budget {
  return { id: category.id, categoryId: category.id, month: "2026-08", limit, priority };
}

function expenseFor(category: Category, amount: number): Transaction {
  return {
    id: crypto.randomUUID(),
    categoryId: category.id,
    amount,
    type: "expense",
    date: "2026-08-03",
    createdAt: "2026-08-03T00:00:00.000Z",
  };
}

describe("budgetSuggestions", () => {
  it("returns an empty list when nothing is over budget", () => {
    const { state, rent, groceries } = setup();
    const suggestions = budgetSuggestions({
      month: "2026-08",
      budgets: [budgetFor(rent, 5000), budgetFor(groceries, 5000)],
      transactions: [expenseFor(rent, 1000)],
      categories: state.categories,
    });
    expect(suggestions).toEqual([]);
  });

  it("suggests covering the spent amount and reports the overspend", () => {
    const { state, rent, groceries } = setup();
    const suggestions = budgetSuggestions({
      month: "2026-08",
      budgets: [budgetFor(rent, 4000), budgetFor(groceries, 5000)],
      transactions: [expenseFor(rent, 6000)],
      categories: state.categories,
    });
    expect(suggestions).toHaveLength(1);
    const [suggestion] = suggestions;
    expect(suggestion.budget.id).toBe(rent.id);
    expect(suggestion.overspent).toBe(2000);
    expect(suggestion.suggestedLimit).toBe(6000);
    expect(suggestion.trim).not.toBeNull();
    expect(suggestion.trim?.budget.categoryId).toBe(groceries.id);
    expect(suggestion.trim?.remaining).toBe(5000);
  });

  it("picks the least-used budget as the trim candidate", () => {
    const { state, rent, groceries, transport } = setup();
    const suggestions = budgetSuggestions({
      month: "2026-08",
      budgets: [
        budgetFor(rent, 4000),
        budgetFor(groceries, 5000),
        budgetFor(transport, 3000),
      ],
      transactions: [
        expenseFor(rent, 6000),
        expenseFor(groceries, 4000),
        expenseFor(transport, 2000),
      ],
      categories: state.categories,
    });
    const [suggestion] = suggestions;
    expect(suggestion.trim?.budget.categoryId).toBe(transport.id);
  });

  it("flags whether remaining income covers the overage", () => {
    const { state, rent, groceries } = setup();
    const base = {
      month: "2026-08",
      budgets: [budgetFor(rent, 4000), budgetFor(groceries, 5000)],
      categories: state.categories,
    };
    const income: Transaction = {
      id: crypto.randomUUID(),
      categoryId: state.categories.find((c) => c.kind === "income")!.id,
      amount: 5500,
      type: "income",
      date: "2026-08-01",
      createdAt: "2026-08-01T00:00:00.000Z",
      monthlyIncome: true,
    };
    const [covered] = budgetSuggestions({
      ...base,
      transactions: [expenseFor(rent, 6000), { ...income, amount: 8000 }],
    });
    expect(covered.coveredByRemaining).toBe(true);
    const [short] = budgetSuggestions({
      ...base,
      transactions: [expenseFor(rent, 6000), { ...income, amount: 3000 }],
    });
    expect(short.coveredByRemaining).toBe(false);
  });
});
