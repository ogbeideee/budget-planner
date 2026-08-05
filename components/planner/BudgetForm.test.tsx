import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { BudgetForm } from "./BudgetForm";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function expenseCategoryIds(): string[] {
  return useAppStore
    .getState()
    .state.categories.filter((category) => category.kind === "expense")
    .map((category) => category.id);
}

describe("BudgetForm category state", () => {
  it("clears the category validation error immediately once a category is selected", async () => {
    const user = userEvent.setup();
    render(<BudgetForm open onClose={() => {}} month="2026-08" />);

    await user.click(screen.getByRole("button", { name: "Add budget" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a category.");

    const [categoryId] = expenseCategoryIds();
    await user.selectOptions(screen.getByLabelText("Category"), categoryId);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("submits the selected category id and creates the budget", async () => {
    const user = userEvent.setup();
    render(<BudgetForm open onClose={() => {}} month="2026-08" />);

    const [categoryId] = expenseCategoryIds();
    await user.selectOptions(screen.getByLabelText("Category"), categoryId);
    await user.type(screen.getByLabelText("Limit"), "1000");
    await user.click(screen.getByRole("button", { name: "Add budget" }));

    const { state } = useAppStore.getState();
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].categoryId).toBe(categoryId);
    expect(state.budgets[0].limit).toBe(100000);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the amount error as soon as the limit becomes valid", async () => {
    const user = userEvent.setup();
    render(<BudgetForm open onClose={() => {}} month="2026-08" />);

    const [categoryId] = expenseCategoryIds();
    await user.selectOptions(screen.getByLabelText("Category"), categoryId);
    await user.type(screen.getByLabelText("Limit"), "abc");
    await user.click(screen.getByRole("button", { name: "Add budget" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid amount");

    const limit = screen.getByLabelText("Limit");
    await user.clear(limit);
    await user.type(limit, "50");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pre-selects the existing category when editing a budget", () => {
    const [categoryId] = expenseCategoryIds();
    useAppStore.getState().addBudget({
      categoryId,
      month: "2026-08",
      limit: 5000,
      priority: "medium",
    });
    const budget = useAppStore.getState().state.budgets[0];

    render(
      <BudgetForm open onClose={() => {}} month="2026-08" budget={budget} />,
    );

    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.value).toBe(categoryId);
  });

  it("persists a category change made while editing a budget", async () => {
    const user = userEvent.setup();
    const [first, second] = expenseCategoryIds();
    useAppStore.getState().addBudget({
      categoryId: first,
      month: "2026-08",
      limit: 5000,
      priority: "medium",
    });
    const budget = useAppStore.getState().state.budgets[0];

    render(
      <BudgetForm open onClose={() => {}} month="2026-08" budget={budget} />,
    );
    await user.selectOptions(screen.getByLabelText("Category"), second);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const { state } = useAppStore.getState();
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].categoryId).toBe(second);
    expect(state.budgets[0].limit).toBe(5000);
  });

  it("keeps its own form id so submit never targets another instance", () => {
    render(<BudgetForm open onClose={() => {}} month="2026-08" />);
    render(<BudgetForm open onClose={() => {}} month="2026-08" />);

    const formIds = Array.from(document.querySelectorAll("form")).map(
      (form) => form.id,
    );
    expect(new Set(formIds).size).toBe(2);
    for (const formId of formIds) {
      const button = document.querySelector(
        `button[form="${formId}"]`,
      ) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      expect(button!.textContent?.trim()).toBe("Add budget");
    }
  });
});
