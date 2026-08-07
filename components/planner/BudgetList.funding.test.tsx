import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

async function openAllocation() {
  const user = userEvent.setup();
  render(<BudgetList month="2026-08" />);
  await user.click(screen.getByRole("button", { name: /Budget Allocation/ }));
}

function fundingBar(): HTMLElement {
  const label = screen.getByText(
    /Allocated \$2,590\.00 of \$(3,500\.00|2,665\.00|2,000\.00) allocatable/,
  );
  return label.closest("div")!.parentElement!;
}

function overAllocatedBar(): HTMLElement {
  return screen.getByText("Over allocated").closest("div")!.parentElement!;
}

describe("Budget Allocation funding bar", () => {
  it("shows committed of allocatable income with a matching percentage (350k income / 259k committed / 91k left)", async () => {
    seed(350000, 259000);
    await openAllocation();

    expect(
      screen.getByText(/Allocated \$2,590\.00 of \$3,500\.00 allocatable/),
    ).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText(/Remaining to allocate \$910\.00/)).toBeInTheDocument();
    expect(fundingBar().querySelector('[role="progressbar"]')).toHaveAttribute(
      "aria-valuenow",
      "74",
    );
  });

  it("shows the true ratio without rounding up to 100 (266.5k income / 259k committed / 7.5k left)", async () => {
    seed(266500, 259000);
    await openAllocation();

    expect(
      screen.getByText(/Allocated \$2,590\.00 of \$2,665\.00 allocatable/),
    ).toBeInTheDocument();
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText(/Remaining to allocate \$75\.00/)).toBeInTheDocument();
    expect(fundingBar().querySelector('[role="progressbar"]')).toHaveAttribute(
      "aria-valuenow",
      "97",
    );
  });

  it("over-allocated: labels it, shows the true percentage, clamps only the bar", async () => {
    seed(200000, 259000);
    await openAllocation();

    expect(screen.getByText("Over allocated")).toBeInTheDocument();
    expect(screen.getByText("130%")).toBeInTheDocument();
    expect(
      screen.getByText(/Limits exceed the allocatable income/),
    ).toBeInTheDocument();
    const overBar = overAllocatedBar();
    expect(overBar.querySelector('[role="progressbar"]')).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(
      screen.queryByText(/Allocated \$2,590\.00 of \$2,000\.00 allocatable/),
    ).not.toBeInTheDocument();
  });
});
