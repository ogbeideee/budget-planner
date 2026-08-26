import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type { Transaction } from "@/lib/types";
import { MonthlyOverview } from "./MonthlyOverview";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function categoryIds() {
  const { state } = useAppStore.getState();
  return {
    expense: state.categories.find((c) => c.kind === "expense")!.id,
    income: state.categories.find((c) => c.kind === "income")!.id,
  };
}

function tx(
  categoryId: string,
  amount: number,
  date: string,
  type: "income" | "expense" = "expense",
): Transaction {
  return {
    id: crypto.randomUUID(),
    categoryId,
    amount,
    type,
    date,
    createdAt: `${date}T00:00:00.000Z`,
  };
}

function renderOverview(transactions: Transaction[]) {
  render(
    <MonthlyOverview
      month="2026-08"
      transactions={transactions}
      incomePlans={[]}
      currency="USD"
    />,
  );
  const card = (label: string) =>
    screen.getByText(label).closest("div.group") as HTMLElement;
  return { card };
}

describe("MonthlyOverview", () => {
  it("shows a green delta when income rose and drops the card shadow", () => {
    const { expense, income } = categoryIds();
    const { card } = renderOverview([
      tx(income, 100000, "2026-07-05", "income"),
      tx(income, 125000, "2026-08-05", "income"),
      tx(expense, 0, "2026-08-06"),
    ]);

    const incomeCard = card("Total income");
    expect(incomeCard.className).toContain("shadow-none");
    expect(
      within(incomeCard).getByText("↑ $250.00 from last month").className,
    ).toContain("text-income");
  });

  it("shows a green delta when expenses fell", () => {
    const { expense, income } = categoryIds();
    const { card } = renderOverview([
      tx(income, 200000, "2026-07-05", "income"),
      tx(expense, 175000, "2026-07-06"),
      tx(income, 200000, "2026-08-05", "income"),
      tx(expense, 100000, "2026-08-06"),
    ]);

    const expensesCard = card("Total expenses");
    expect(
      within(expensesCard).getByText("↓ $750.00 from last month").className,
    ).toContain("text-income");
  });

  it("shows a red delta when expenses rose", () => {
    const { expense, income } = categoryIds();
    const { card } = renderOverview([
      tx(income, 200000, "2026-07-05", "income"),
      tx(expense, 100000, "2026-07-06"),
      tx(income, 200000, "2026-08-05", "income"),
      tx(expense, 175000, "2026-08-06"),
    ]);

    const expensesCard = card("Total expenses");
    expect(
      within(expensesCard).getByText("↑ $750.00 from last month").className,
    ).toContain("text-expense");
  });

  it("keeps the no-prior-month message when comparison data is missing", () => {
    const { expense, income } = categoryIds();
    const { card } = renderOverview([
      tx(income, 200000, "2026-08-05", "income"),
      tx(expense, 50000, "2026-08-06"),
    ]);

    within(card("Total expenses")).getByText("No prior month to compare yet");
  });

  it("shows a percentage delta for the savings rate", () => {
    const { expense, income } = categoryIds();
    const { card } = renderOverview([
      tx(income, 100000, "2026-07-05", "income"),
      tx(expense, 50000, "2026-07-06"),
      tx(income, 100000, "2026-08-05", "income"),
      tx(expense, 48000, "2026-08-06"),
    ]);

    const rateCard = card("Savings rate");
    expect(
      within(rateCard).getByText("↑ 2% from last month").className,
    ).toContain("text-income");
  });
});