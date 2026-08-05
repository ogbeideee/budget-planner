import { describe, expect, it } from "vitest";
import { monthStats } from "../monthStats";
import { createInitialState } from "../seed";
import type { Budget, Category, FutureExpense, Transaction } from "../types";

function setup() {
  const state = createInitialState();
  const expense = state.categories.filter((c) => c.kind === "expense");
  const income = state.categories.find((c) => c.kind === "income")!;
  return { state, expense, income };
}

function txn(
  category: Category,
  amount: number,
  date: string,
  note?: string,
): Transaction {
  return {
    id: crypto.randomUUID(),
    categoryId: category.id,
    amount,
    type: category.kind,
    date,
    note,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function budget(category: Category, limit: number): Budget {
  return {
    id: `${category.id}-b`,
    categoryId: category.id,
    month: "2026-08",
    limit,
    priority: "medium",
  };
}

function future(category: Category, amount: number, dueDate: string): FutureExpense {
  return {
    id: crypto.randomUUID(),
    categoryId: category.id,
    amount,
    title: "Phone bill",
    dueDate,
    recurring: true,
    priority: "medium",
    status: "upcoming",
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("monthStats", () => {
  it("finds the largest expense of the month", () => {
    const { state, expense } = setup();
    const [rent, groceries] = expense;
    const stats = monthStats({
      month: "2026-08",
      transactions: [
        txn(groceries, 1200, "2026-08-02", "Lunch"),
        txn(rent, 5000, "2026-08-01", "August rent"),
      ],
      budgets: [],
      categories: state.categories,
      futureExpenses: [],
    });
    expect(stats.largestExpense).toEqual({
      amount: 5000,
      label: "August rent",
      categoryId: rent.id,
    });
  });

  it("falls back to the category name for unnamed expenses", () => {
    const { state, expense } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [txn(expense[0], 800, "2026-08-02")],
      budgets: [],
      categories: state.categories,
      futureExpenses: [],
    });
    expect(stats.largestExpense?.label).toBe(expense[0].name);
  });

  it("reports the most funded budget", () => {
    const { state, expense } = setup();
    const [rent, groceries] = expense;
    const stats = monthStats({
      month: "2026-08",
      transactions: [],
      budgets: [budget(rent, 3000), budget(groceries, 6000)],
      categories: state.categories,
      futureExpenses: [],
    });
    expect(stats.mostFunded).toEqual({
      categoryName: groceries.name,
      limit: 6000,
    });
  });

  it("picks the nearest upcoming payment", () => {
    const { state, expense } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [],
      budgets: [],
      categories: state.categories,
      futureExpenses: [
        future(expense[0], 1500, "2026-12-01"),
        future(expense[0], 2000, "2026-08-20"),
      ],
    });
    expect(stats.upcomingPayment?.dueDate).toBe("2026-08-20");
    expect(stats.upcomingPayment?.amount).toBe(2000);
  });

  it("ignores paid future expenses", () => {
    const { state, expense } = setup();
    const paid = future(expense[0], 1500, "2026-08-05");
    paid.status = "paid";
    const stats = monthStats({
      month: "2026-08",
      transactions: [],
      budgets: [],
      categories: state.categories,
      futureExpenses: [paid],
    });
    expect(stats.upcomingPayment).toBeNull();
  });

  it("computes the savings rate as a percentage of income", () => {
    const { state, expense, income } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [txn(income, 10000, "2026-08-01"), txn(expense[0], 2500, "2026-08-02")],
      budgets: [],
      categories: state.categories,
      futureExpenses: [],
    });
    expect(stats.savingsRate).toBe(75);
  });

  it("returns null savings rate without income", () => {
    const { state, expense } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [txn(expense[0], 500, "2026-08-02")],
      budgets: [],
      categories: state.categories,
      futureExpenses: [],
    });
    expect(stats.savingsRate).toBeNull();
  });

  it("compares net against the previous month", () => {
    const { state, expense, income } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [
        txn(income, 10000, "2026-08-01"),
        txn(expense[0], 3000, "2026-08-02"),
        txn(income, 9000, "2026-07-01"),
        txn(expense[0], 4000, "2026-07-02"),
      ],
      budgets: [],
      categories: state.categories,
      futureExpenses: [],
    });
    expect(stats.vsLastMonth).toEqual({
      delta: 2000,
      lastNet: 5000,
      thisNet: 7000,
    });
  });

  it("projects remaining as expected income minus expenses", () => {
    const { state, expense } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [txn(expense[0], 2000, "2026-08-02")],
      budgets: [],
      categories: state.categories,
      futureExpenses: [
        future(expense[0], 1500, "2026-08-20"),
        future(expense[0], 3000, "2026-09-20"),
      ],
      incomePlans: [
        {
          id: "plan-1",
          month: "2026-08",
          name: "Salary",
          icon: "💰",
          expectedAmount: 8000,
          receivedAmount: 0,
        },
      ],
    });
    expect(stats.projectedRemaining).toBe(6000);
  });

  it("returns null projected remaining without expected income", () => {
    const { state, expense } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [txn(expense[0], 2000, "2026-08-02")],
      budgets: [],
      categories: state.categories,
      futureExpenses: [],
    });
    expect(stats.projectedRemaining).toBeNull();
  });

  it("uses received income for net and savings rate", () => {
    const { state, expense } = setup();
    const stats = monthStats({
      month: "2026-08",
      transactions: [txn(expense[0], 2000, "2026-08-02")],
      budgets: [],
      categories: state.categories,
      futureExpenses: [],
      incomePlans: [
        {
          id: "plan-1",
          month: "2026-08",
          name: "Salary",
          icon: "💰",
          expectedAmount: 10000,
          receivedAmount: 8000,
        },
      ],
    });
    expect(stats.vsLastMonth).toEqual({
      delta: 6000,
      lastNet: 0,
      thisNet: 6000,
    });
    expect(stats.savingsRate).toBe(75);
    expect(stats.projectedRemaining).toBe(8000);
  });
});
