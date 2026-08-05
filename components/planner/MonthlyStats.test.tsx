import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { MonthlyStats } from "./MonthlyStats";
import type { IncomePlan } from "@/lib/types";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function seedStats() {
  const state = useAppStore.getState().state;
  const rent = state.categories.find((c) => c.name === "Rent")!;
  const groceries = state.categories.find((c) => c.name === "Groceries")!;
  const incomePlan: IncomePlan = {
    id: "plan-1",
    month: "2026-08",
    name: "Salary",
    icon: "💰",
    expectedAmount: 100000,
    receivedAmount: 100000,
  };
  const now = new Date().toISOString();
  useAppStore.setState({
    state: {
      ...state,
      incomePlans: [incomePlan],
      transactions: [
        {
          id: "t1",
          type: "expense",
          categoryId: rent.id,
          amount: 50000,
          date: "2026-08-02",
          note: "August rent",
          createdAt: now,
        },
        {
          id: "t2",
          type: "expense",
          categoryId: groceries.id,
          amount: 20000,
          date: "2026-08-05",
          createdAt: now,
        },
      ],
      futureExpenses: [
        {
          id: "f1",
          categoryId: rent.id,
          amount: 10000,
          title: "Internet",
          dueDate: "2026-08-20",
          recurring: false,
          priority: "medium",
          status: "upcoming",
          createdAt: now,
        },
      ],
    },
  });
}

function cell(label: string): HTMLElement {
  return screen.getByText(label).closest("div")!;
}

describe("MonthlyStats metric presentation", () => {
  it("shows the largest expense with a category badge", () => {
    seedStats();
    render(<MonthlyStats month="2026-08" />);

    const largest = cell("Largest expense");
    expect(within(largest).getByText("$500.00")).toBeInTheDocument();
    expect(within(largest).getByText("August rent")).toBeInTheDocument();
    expect(largest.querySelector("svg")).toBeNull();
    expect(largest.querySelector("span[aria-hidden='true']")).toBeTruthy();
  });

  it("shows a green up arrow for a positive savings rate", () => {
    seedStats();
    render(<MonthlyStats month="2026-08" />);

    const savings = cell("Savings rate");
    expect(within(savings).getByText("30%")).toBeInTheDocument();
    expect(savings.querySelector("svg")).toHaveClass("text-income");
  });

  it("shows a red down arrow for a negative savings rate", () => {
    seedStats();
    const state = useAppStore.getState().state;
    useAppStore.setState({
      state: {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === "t2" ? { ...t, amount: 90000 } : t,
        ),
      },
    });
    render(<MonthlyStats month="2026-08" />);

    const savings = cell("Savings rate");
    expect(savings.querySelector("svg")).toHaveClass("text-expense");
  });

  it("shows a wallet icon for projected remaining", () => {
    seedStats();
    render(<MonthlyStats month="2026-08" />);

    const projected = cell("Projected remaining");
    expect(within(projected).getByText("$300.00")).toBeInTheDocument();
    expect(projected.querySelector("svg")).toHaveClass("text-muted");
  });
});
