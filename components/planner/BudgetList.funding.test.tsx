import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { BudgetList } from "./BudgetList";
import type { IncomePlan } from "@/lib/types";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function seed(income: number, committed: number) {
  const state = useAppStore.getState().state;
  const rentId = state.categories.find((category) => category.name === "Rent")!
    .id;
  const incomePlan: IncomePlan = {
    id: "plan-1",
    month: "2026-08",
    name: "Salary",
    icon: "💰",
    expectedAmount: income,
    receivedAmount: income,
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
          limit: committed,
          priority: "high",
        },
      ],
    },
  });
}

function renderSection() {
  render(<BudgetList month="2026-08" />);
}

function bars(): HTMLElement[] {
  return screen.getAllByRole("progressbar");
}

describe("Budgets donut card", () => {
  it("shows Budgeted/committed in the centre with the allocated percentage (350k income / 259k committed / 91k left)", async () => {
    seed(350000, 259000);
    renderSection();

    expect(screen.getByText("Budgeted")).toBeInTheDocument();
    expect(screen.getByText("of $3,500.00 · 74%")).toBeInTheDocument();

    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("$910.00")).toBeInTheDocument();
    expect(screen.getByText("26%")).toBeInTheDocument();

    const [allocatedBar, remainingBar] = bars();
    expect(allocatedBar).toHaveAttribute("aria-valuenow", "74");
    expect(remainingBar).toHaveAttribute("aria-valuenow", "26");
  });

  it("shows the true ratio without rounding up to 100 (266.5k income / 259k committed / 7.5k left)", async () => {
    seed(266500, 259000);
    renderSection();

    expect(screen.getByText("of $2,665.00 · 97%")).toBeInTheDocument();
    expect(screen.getByText("$75.00")).toBeInTheDocument();
    expect(screen.getByText("3%")).toBeInTheDocument();

    const [allocatedBar, remainingBar] = bars();
    expect(allocatedBar).toHaveAttribute("aria-valuenow", "97");
    expect(remainingBar).toHaveAttribute("aria-valuenow", "3");
  });

  it("over-allocated: labels the true percentage and clamps only the bar", async () => {
    seed(200000, 259000);
    renderSection();

    expect(screen.getByText(/· 130%/)).toBeInTheDocument();
    expect(
      screen.getByText(/Limits exceed the allocatable income/),
    ).toBeInTheDocument();

    const [allocatedBar, remainingBar] = bars();
    expect(allocatedBar).toHaveAttribute("aria-valuenow", "100");
    expect(remainingBar).toHaveAttribute("aria-valuenow", "0");
  });
});