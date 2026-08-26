import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { BudgetList } from "./BudgetList";

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

describe("lowercase category display", () => {
  it("renders a stored lowercase name capitalized in the list and legend", () => {
    const state = useAppStore.getState().state;
    const internet = { ...state.categories[0], id: "c-int", name: "internet" };
    useAppStore.setState({
      state: {
        ...state,
        categories: [...state.categories, internet],
        budgets: [
          {
            id: "b-int",
            categoryId: "c-int",
            month: "2026-08",
            limit: 50000,
            priority: "medium" as const,
          },
        ],
      },
    });
    render(<BudgetList month="2026-08" />);

    expect(screen.getAllByText("Internet").length).toBeGreaterThan(0);
    expect(screen.queryByText("internet")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Edit Internet budget" }),
    ).toBeInTheDocument();
  });
});
