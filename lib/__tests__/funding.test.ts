import { describe, expect, it } from "vitest";
import { fundingNeeds } from "../funding";
import type { Budget, Category, FutureExpense } from "../types";

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
  month = "2026-08",
): Budget {
  return {
    id: `b-${categoryId}`,
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

const categories = [
  category("cat-rent", "Rent", "expense"),
  category("cat-food", "Food", "expense"),
  category("cat-salary", "Salary", "income"),
];

describe("fundingNeeds (single source of truth)", () => {
  it("lists every unbudgeted expense category, even without upcoming expenses", () => {
    const result = fundingNeeds([], categories, [], "2026-08");
    expect(result.map((need) => need.category.id)).toEqual([
      "cat-food",
      "cat-rent",
    ]);
  });

  it("marks unbudgeted rows with target/allocated/missing of 0", () => {
    const [need] = fundingNeeds([], categories, [], "2026-08");
    expect(need).toMatchObject({
      target: 0,
      allocated: 0,
      missing: 0,
      budgeted: false,
    });
  });

  it("excludes categories with a budget limit > 0 and no obligation gap", () => {
    const result = fundingNeeds(
      [budget("cat-rent", 1000), budget("cat-food", 1500)],
      categories,
      [],
      "2026-08",
    );
    expect(result).toEqual([]);
  });

  it("treats a budget limit of 0 as unbudgeted", () => {
    const result = fundingNeeds(
      [budget("cat-rent", 0), budget("cat-food", 1500)],
      categories,
      [],
      "2026-08",
    );
    expect(result.map((need) => need.category.id)).toEqual(["cat-rent"]);
  });

  it("sums upcoming expenses per category as the target", () => {
    const result = fundingNeeds(
      [],
      categories,
      [
        expense("e1", "cat-rent", 1000, "2026-08-10"),
        expense("e2", "cat-rent", 500, "2026-08-20"),
        expense("e3", "cat-food", 200, "2026-08-05"),
      ],
      "2026-08",
    );
    const rent = result.find((need) => need.category.id === "cat-rent")!;
    expect(rent.target).toBe(1500);
    expect(rent.allocated).toBe(0);
    expect(rent.missing).toBe(1500);
  });

  it("excludes paid expenses and expenses outside the selected month from the target", () => {
    const result = fundingNeeds(
      [],
      categories,
      [
        expense("e1", "cat-rent", 1000, "2026-08-10", "paid"),
        expense("e2", "cat-rent", 900, "2026-09-10"),
      ],
      "2026-08",
    );
    const rent = result.find((need) => need.category.id === "cat-rent")!;
    expect(rent.target).toBe(0);
    expect(rent.missing).toBe(0);
  });

  it("subtracts the month budget limit from the target for budgeted rows", () => {
    const result = fundingNeeds(
      [budget("cat-rent", 400)],
      categories,
      [expense("e1", "cat-rent", 1000, "2026-08-10")],
      "2026-08",
    );
    const rent = result.find((need) => need.category.id === "cat-rent")!;
    expect(rent).toMatchObject({ allocated: 400, missing: 600, budgeted: true });
  });

  it("drops budgeted categories whose limit already covers the target", () => {
    const result = fundingNeeds(
      [budget("cat-rent", 1500), budget("cat-food", 900)],
      categories,
      [expense("e1", "cat-rent", 1000, "2026-08-10")],
      "2026-08",
    );
    expect(result).toEqual([]);
  });

  it("keeps budgeted categories with a remaining obligation gap", () => {
    const result = fundingNeeds(
      [budget("cat-rent", 1500)],
      categories,
      [expense("e1", "cat-rent", 2000, "2026-08-10")],
      "2026-08",
    );
    const rent = result.find((need) => need.category.id === "cat-rent")!;
    expect(rent.missing).toBe(500);
  });

  it("ignores budgets from other months", () => {
    const result = fundingNeeds(
      [budget("cat-rent", 1000, "2026-07")],
      categories,
      [],
      "2026-08",
    );
    expect(result.map((need) => need.category.id)).toEqual([
      "cat-food",
      "cat-rent",
    ]);
  });

  it("excludes income categories even when unbudgeted", () => {
    const result = fundingNeeds([], categories, [], "2026-08");
    expect(result.some((need) => need.category.kind === "income")).toBe(false);
  });

  it("sorts by largest missing first, name as tiebreak", () => {
    const result = fundingNeeds(
      [budget("cat-rent", 300), budget("cat-food", 500)],
      categories,
      [
        expense("e1", "cat-food", 800, "2026-08-10"),
        expense("e2", "cat-rent", 1000, "2026-08-10"),
      ],
      "2026-08",
    );
    expect(result.map((need) => need.category.id)).toEqual([
      "cat-rent",
      "cat-food",
    ]);
  });

  it("puts unbudgeted zero-obligation categories after gap rows, sorted by name", () => {
    const result = fundingNeeds(
      [],
      categories,
      [expense("e1", "cat-food", 500, "2026-08-10")],
      "2026-08",
    );
    expect(result.map((need) => need.category.id)).toEqual([
      "cat-food",
      "cat-rent",
    ]);
  });
});
