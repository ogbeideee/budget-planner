import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { reportTrends } from "@/lib/reportTrends";
import { useAppStore } from "@/store/useAppStore";
import type { Month, Transaction } from "@/lib/types";
import { FinancialInsights } from "./FinancialInsights";

const MONTHS: Month[] = ["2026-06", "2026-07", "2026-08"];

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function seedTransactions(): Transaction[] {
  const { state } = useAppStore.getState();
  const expense = state.categories.find((c) => c.kind === "expense")!.id;
  const income = state.categories.find((c) => c.kind === "income")!.id;
  const tx = (
    categoryId: string,
    amount: number,
    date: string,
    type: "income" | "expense" = "expense",
  ): Transaction => ({
    id: crypto.randomUUID(),
    categoryId,
    amount,
    type,
    date,
    createdAt: `${date}T00:00:00.000Z`,
  });
  return [
    tx(income, 200000, "2026-06-05", "income"),
    tx(expense, 100000, "2026-06-06"),
    tx(income, 200000, "2026-07-05", "income"),
    tx(expense, 150000, "2026-07-06"),
    tx(income, 200000, "2026-08-05", "income"),
    tx(expense, 120000, "2026-08-06"),
  ];
}

describe("FinancialInsights", () => {
  it("renders a tinted main card with the savings headline", () => {
    const transactions = seedTransactions();
    const { state } = useAppStore.getState();
    const trends = reportTrends({
      transactions,
      categories: state.categories,
      months: MONTHS,
    });

    render(
      <FinancialInsights
        month="2026-08"
        trends={trends}
        budgets={[]}
        rollovers={[]}
        categories={state.categories}
        transactions={transactions}
        currency="USD"
      />,
    );

    expect(
      screen.getByText(/Your savings improved by \$300\.00 this month/),
    ).toBeInTheDocument();

    const card = document.querySelector("section")!;
    expect(card.className).toContain("border-brand-500/20");
    expect(card.className).toContain("bg-brand-500/[0.03]");
    expect(card.className).toContain("shadow-none");
  });

  it("renders the three supporting insights as bordered compact cards", () => {
    const transactions = seedTransactions();
    const { state } = useAppStore.getState();
    const trends = reportTrends({
      transactions,
      categories: state.categories,
      months: MONTHS,
    });

    const { container } = render(
      <FinancialInsights
        month="2026-08"
        trends={trends}
        budgets={[]}
        rollovers={[]}
        categories={state.categories}
        transactions={transactions}
        currency="USD"
      />,
    );

    const rows = container.querySelectorAll("ul li");
    expect(rows.length).toBe(3);
    rows.forEach((row) => {
      expect(row.className).toContain("rounded-xl");
      expect(row.className).toContain("border-border/60");
    });
  });
});