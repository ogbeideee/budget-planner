import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { AllocationPanel } from "./AllocationPanel";
import type { Budget, IncomePlan } from "@/lib/types";

const MONTH = "2026-08";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function categoryId(name: string): string {
  return useAppStore
    .getState()
    .state.categories.find((category) => category.name === name)!.id;
}

function seedBudget(categoryName: string, limit: number): Budget {
  const state = useAppStore.getState().state;
  const budget: Budget = {
    id: crypto.randomUUID(),
    categoryId: categoryId(categoryName),
    month: MONTH,
    limit,
    priority: "medium",
  };
  useAppStore.setState({
    state: { ...state, budgets: [...state.budgets, budget] },
  });
  return budget;
}

function seedReceived(amount: number) {
  const state = useAppStore.getState().state;
  const plan: IncomePlan = {
    id: crypto.randomUUID(),
    month: MONTH,
    name: "Salary",
    icon: "💰",
    expectedAmount: 0,
    receivedAmount: amount,
  };
  useAppStore.setState({
    state: { ...state, incomePlans: [plan] },
  });
}

describe("AllocationPanel", () => {
  it("renders nothing when the month has no budgets", () => {
    seedReceived(50000);
    const { container } = render(<AllocationPanel month={MONTH} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a message when there is nothing left to allocate", () => {
    seedBudget("Rent", 20000);
    render(<AllocationPanel month={MONTH} />);
    expect(
      screen.getByText(/nothing left to allocate/i),
    ).toBeInTheDocument();
  });

  it("keeps sliders usable when the remaining balance is under one whole unit", () => {
    seedBudget("Rent", 0);
    seedReceived(50);
    render(<AllocationPanel month={MONTH} />);
    const slider = screen.getByRole("slider", { name: "Allocate" });
    expect(slider).toHaveAttribute("step", "50");
    expect(slider).toHaveAttribute("max", "50");
    fireEvent.change(slider, { target: { value: "50" } });
    expect(slider).toHaveValue("50");
  });

  it("uses whole-unit steps for normal balances", () => {
    seedBudget("Rent", 20000);
    seedReceived(100000);
    render(<AllocationPanel month={MONTH} />);
    expect(
      screen.getByRole("slider", { name: "Allocate" }),
    ).toHaveAttribute("step", "100");
  });

  it("applies allocations by raising budget limits", async () => {
    const user = userEvent.setup();
    const budget = seedBudget("Rent", 20000);
    seedReceived(100000);
    render(<AllocationPanel month={MONTH} />);
    const slider = screen.getByRole("slider", { name: "Allocate" });
    fireEvent.change(slider, { target: { value: "50000" } });
    await user.click(
      screen.getByRole("button", { name: "Apply allocations" }),
    );
    const updated = useAppStore
      .getState()
      .state.budgets.find((entry) => entry.id === budget.id)!;
    expect(updated.limit).toBe(70000);
  });

  it("clamps combined allocations to the remaining balance", () => {
    seedBudget("Rent", 20000);
    seedBudget("Groceries", 10000);
    seedReceived(50000);
    render(<AllocationPanel month={MONTH} />);
    const sliders = screen.getAllByRole("slider", { name: "Allocate" });
    fireEvent.change(sliders[0], { target: { value: "40000" } });
    fireEvent.change(sliders[1], { target: { value: "30000" } });
    expect(sliders[1]).toHaveValue("10000");
    expect(
      screen.getByText((_, node) => node?.textContent === "$0.00 unallocated"),
    ).toBeInTheDocument();
  });
});
