import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { NeedsFundingSection } from "./NeedsFundingSection";

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

function checklistNames(): string[] {
  return screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent ?? "");
}

describe("NeedsFundingSection (AC-25)", () => {
  it("lists exactly the unfunded expense categories sorted by name, excluding income", () => {
    render(<NeedsFundingSection month="2026-08" />);

    expect(checklistNames()).toEqual([
      "Entertainment",
      "Groceries",
      "Rent",
      "Transport",
      "Utilities",
    ]);
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
    expect(screen.getByText("5 categories")).toBeInTheDocument();
  });

  it("excludes categories that already have a funded budget this month", () => {
    useAppStore.getState().addBudget({
      categoryId: categoryId("Rent"),
      month: "2026-08",
      limit: 100000,
      priority: "high",
    });

    render(<NeedsFundingSection month="2026-08" />);

    expect(checklistNames()).toEqual([
      "Entertainment",
      "Groceries",
      "Transport",
      "Utilities",
    ]);
  });

  it("shows the empty state when everything is funded", () => {
    for (const name of ["Rent", "Groceries", "Transport", "Utilities", "Entertainment"]) {
      useAppStore.getState().addBudget({
        categoryId: categoryId(name),
        month: "2026-08",
        limit: 50000,
        priority: "medium",
      });
    }

    render(<NeedsFundingSection month="2026-08" />);

    expect(screen.getByText(/Everything is funded/)).toBeInTheDocument();
  });

  it("Fund opens the budget form with the category preselected", async () => {
    const user = userEvent.setup();
    render(<NeedsFundingSection month="2026-08" />);

    const rentRow = screen.getByText("Rent").closest("li")!;
    await user.click(within(rentRow).getByRole("button", { name: "Fund" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("New budget")).toBeInTheDocument();
    const categorySelect = within(dialog).getByLabelText(
      "Category",
    ) as HTMLSelectElement;
    expect(categorySelect.value).toBe(categoryId("Rent"));
  });

  it("funding a category removes it from the checklist and persists the budget", async () => {
    const user = userEvent.setup();
    render(<NeedsFundingSection month="2026-08" />);

    const rentRow = screen.getByText("Rent").closest("li")!;
    await user.click(within(rentRow).getByRole("button", { name: "Fund" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Limit"), "1000");
    await user.click(within(dialog).getByRole("button", { name: "Add budget" }));

    const { state } = useAppStore.getState();
    const rentBudget = state.budgets.find(
      (budget) => budget.categoryId === categoryId("Rent"),
    );
    expect(rentBudget?.limit).toBe(100000);

    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    expect(checklistNames()).toEqual([
      "Entertainment",
      "Groceries",
      "Transport",
      "Utilities",
    ]);
  });
});
