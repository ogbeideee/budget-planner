import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { BudgetList } from "./BudgetList";
import type { IncomePlan } from "@/lib/types";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function seedMonthWithBudget() {
  const state = useAppStore.getState().state;
  const rentId = state.categories.find((c) => c.name === "Rent")!.id;
  const incomePlan: IncomePlan = {
    id: "plan-1",
    month: "2026-08",
    name: "Salary",
    icon: "💰",
    expectedAmount: 100000,
    receivedAmount: 100000,
  };
  useAppStore.setState({
    state: {
      ...state,
      incomePlans: [incomePlan],
      budgets: [
        {
          id: "budget-rent",
          categoryId: rentId,
          month: "2026-08",
          limit: 20000,
          priority: "high",
        },
      ],
    },
  });
}

describe("BudgetList focus-budget flow", () => {
  it("highlights the row without mounting any always-on allocation slider", async () => {
    seedMonthWithBudget();
    render(<BudgetList month="2026-08" />);

    const row = document.getElementById("budget-row-budget-rent");
    expect(row).toBeTruthy();
    expect(row).not.toHaveClass("ring-2");

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("planner:focus-budget", {
          detail: { budgetId: "budget-rent" },
        }),
      );
    });

    expect(row).toHaveClass("ring-2");
    // Allocation now lives in an on-demand drawer, so the page itself carries
    // no sliders until the user asks for one.
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });

  it("ignores events for unknown budgets without highlighting anything", async () => {
    seedMonthWithBudget();
    render(<BudgetList month="2026-08" />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("planner:focus-budget", {
          detail: { budgetId: "does-not-exist" },
        }),
      );
    });

    expect(
      screen.getByRole("heading", { name: /Budgets/ }),
    ).toBeInTheDocument();
    const row = document.getElementById("budget-row-budget-rent");
    expect(row).toBeTruthy();
    expect(row).not.toHaveClass("ring-2");
  });

  it("handles a focus event dispatched synchronously right after the budget is added", async () => {
    seedMonthWithBudget();
    render(<BudgetList month="2026-08" />);

    const utilitiesId = useAppStore
      .getState()
      .state.categories.find((c) => c.name === "Utilities")!.id;
    useAppStore.getState().addBudget({
      categoryId: utilitiesId,
      month: "2026-08",
      limit: 30000,
      priority: "medium",
    });
    const budgetId = useAppStore
      .getState()
      .state.budgets.find(
        (b) => b.month === "2026-08" && b.categoryId === utilitiesId,
      )!.id;

    window.dispatchEvent(
      new CustomEvent("planner:focus-budget", {
        detail: { budgetId },
      }),
    );

    await act(async () => {});

    const row = document.getElementById(`budget-row-${budgetId}`);
    expect(row).toBeTruthy();
    expect(row).toHaveClass("ring-2");
  });
});
