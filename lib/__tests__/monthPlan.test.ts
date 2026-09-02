import { describe, expect, it } from "vitest";
import { monthPlan } from "../monthPlan";
import type { Budget, Category, FutureExpense, IncomePlan } from "../types";

const MONTH = "2099-01";
const NEXT_MONTH = "2099-02";

function category(
  id: string,
  name: string,
  kind: "income" | "expense",
): Category {
  return {
    id,
    name,
    icon: "•",
    color: "#000000",
    kind,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function budget(
  categoryId: string,
  limit: number,
  month: string = MONTH,
): Budget {
  return {
    id: `b-${categoryId}-${month}`,
    categoryId,
    month,
    limit,
    priority: "medium",
  };
}

function expense(
  id: string,
  categoryId: string,
  amount: number,
  dueDate: string,
  status: "upcoming" | "paid" = "upcoming",
): FutureExpense {
  return {
    id,
    categoryId,
    amount,
    title: "Bill",
    dueDate,
    recurring: false,
    priority: "medium",
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function plan(
  name: string,
  expectedAmount: number,
  month: string = MONTH,
  receivedAmount = 0,
): IncomePlan {
  return {
    id: `plan-${name}`,
    month,
    name,
    icon: "💰",
    expectedAmount,
    receivedAmount,
  };
}

const categories = [
  category("cat-rent", "Rent", "expense"),
  category("cat-food", "Food", "expense"),
];

function build(overrides?: {
  budgets?: Budget[];
  futureExpenses?: FutureExpense[];
  incomePlans?: IncomePlan[];
}) {
  return monthPlan({
    month: MONTH,
    budgets: overrides?.budgets ?? [],
    categories,
    futureExpenses: overrides?.futureExpenses ?? [],
    incomePlans: overrides?.incomePlans ?? [],
  });
}

describe("monthPlan (FR-27 composition)", () => {
  it("reports no-income until an income plan exists", () => {
    const result = build();
    expect(result.status).toBe("no-income");
    expect(result.expectedIncome).toBe(0);
    expect(result.totalCommitments).toBe(0);
    expect(result.gaps).toEqual([]);
  });

  it("sums expected income from the month's plans only", () => {
    const result = build({
      incomePlans: [plan("Salary", 500000), plan("Side", 100000, NEXT_MONTH)],
    });
    expect(result.expectedIncome).toBe(500000);
    expect(result.status).toBe("funded");
  });

  it("is underfunded when commitments exceed expected income", () => {
    const result = build({
      incomePlans: [plan("Salary", 300000)],
      budgets: [budget("cat-rent", 400000)],
    });
    expect(result.allocated).toBe(400000);
    expect(result.totalCommitments).toBe(400000);
    expect(result.projectedRemaining).toBe(-100000);
    expect(result.status).toBe("underfunded");
  });

  it("counts only unpaid future expenses due in the month", () => {
    const result = build({
      futureExpenses: [
        expense("e1", "cat-rent", 50000, `${MONTH}-05`),
        expense("e2", "cat-rent", 20000, `${MONTH}-20`, "paid"),
        expense("e3", "cat-rent", 30000, `${NEXT_MONTH}-05`),
      ],
    });
    expect(result.plannedExpenses).toBe(50000);
  });

  it("does not double count an obligation its budget already covers", () => {
    const result = build({
      incomePlans: [plan("Salary", 600000)],
      budgets: [budget("cat-rent", 50000)],
      futureExpenses: [expense("e1", "cat-rent", 50000, `${MONTH}-05`)],
    });
    // The expense is fully covered by the budget: no gap, no unmet amount.
    expect(result.gaps).toEqual([]);
    expect(result.unmetObligations).toBe(0);
    expect(result.totalCommitments).toBe(50000);
    expect(result.projectedRemaining).toBe(550000);
    expect(result.status).toBe("funded");
  });

  it("counts the uncovered part of an under-allocated obligation", () => {
    const result = build({
      incomePlans: [plan("Salary", 600000)],
      budgets: [budget("cat-rent", 50000)],
      futureExpenses: [expense("e1", "cat-rent", 80000, `${MONTH}-05`)],
    });
    expect(result.allocated).toBe(50000);
    expect(result.unmetObligations).toBe(30000);
    expect(result.totalCommitments).toBe(80000);
    expect(result.status).toBe("funded");
  });

  it("treats an unbudgeted category's obligation as fully unmet", () => {
    const result = build({
      incomePlans: [plan("Salary", 600000)],
      futureExpenses: [expense("e1", "cat-food", 40000, `${MONTH}-10`)],
    });
    expect(result.allocated).toBe(0);
    expect(result.unmetObligations).toBe(40000);
    expect(result.totalCommitments).toBe(40000);
    expect(result.status).toBe("funded");
  });

  it("never shows a rollover boost for a month that has not happened", () => {
    // FR-27 decision: future months use BASE limits only. monthPlan does not
    // accept rollover records at all, so allocated is the base limit however
    // the caller is wired; the component test proves a stray record in the
    // store cannot leak a boost through.
    const result = build({
      budgets: [budget("cat-rent", 100000)],
    });
    expect(result.allocated).toBe(100000);
  });

  it("ignores budgets from other months", () => {
    const result = build({
      budgets: [budget("cat-rent", 100000), budget("cat-food", 90000, NEXT_MONTH)],
    });
    expect(result.allocated).toBe(100000);
  });

  it("exposes gaps biggest-first via fundingNeeds ordering", () => {
    const result = build({
      incomePlans: [plan("Salary", 600000)],
      budgets: [budget("cat-rent", 50000)],
      futureExpenses: [
        expense("e1", "cat-rent", 80000, `${MONTH}-05`),
        expense("e2", "cat-food", 40000, `${MONTH}-10`),
      ],
    });
    expect(result.gaps.map((gap) => gap.category.id)).toEqual([
      "cat-food",
      "cat-rent",
    ]);
    expect(result.gaps.map((gap) => gap.missing)).toEqual([40000, 30000]);
    expect(result.unmetObligations).toBe(70000);
  });
});
