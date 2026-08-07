import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { Disclosure } from "@/components/ui/Disclosure";
import type { IncomePlan } from "@/lib/types";
import { BudgetList } from "./BudgetList";
import { NeedsFundingSection } from "./NeedsFundingSection";
import type { FutureExpense } from "@/lib/types";

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

function seedFutureExpenses(
  expenses: Array<
    [name: string, amount: number, dueDate: string, status?: "upcoming" | "paid"]
  >,
) {
  const state = useAppStore.getState().state;
  const now = new Date().toISOString();
  const futureExpenses: FutureExpense[] = [
    ...state.futureExpenses,
    ...expenses.map(
      ([name, amount, dueDate, status = "upcoming"]) => ({
        id: crypto.randomUUID(),
        categoryId: categoryId(name),
        amount,
        title: name,
        dueDate,
        recurring: false,
        priority: "medium" as const,
        status,
        createdAt: now,
      }),
    ),
  ];
  useAppStore.setState({ state: { ...state, futureExpenses } });
}

function seedTypicalGaps() {
  seedFutureExpenses([
    ["Rent", 150000, "2026-08-10"],
    ["Utilities", 80000, "2026-08-25"],
    ["Groceries", 50000, "2026-08-15"],
    ["Transport", 0, "2026-08-20"],
  ]);
}

function gapNames(): string[] {
  return screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent ?? "");
}

describe("NeedsFundingSection (unified funding selector)", () => {
  it("lists unbudgeted categories plus obligation gaps, sorted by missing desc then name", () => {
    seedTypicalGaps();
    render(<NeedsFundingSection month="2026-08" />);

    expect(gapNames()).toEqual([
      "Rent",
      "Utilities",
      "Groceries",
      "Entertainment",
      "Transport",
    ]);
    expect(screen.getByText("5 categories needing funding")).toBeInTheDocument();
  });

  it("shows a brand-new category with no expenses immediately", () => {
    render(<NeedsFundingSection month="2026-08" />);

    expect(gapNames()).toEqual([
      "Entertainment",
      "Groceries",
      "Rent",
      "Transport",
      "Utilities",
    ]);
  });

  it("excludes paid expenses, expenses in other months, and income categories from targets", () => {
    seedTypicalGaps();
    seedFutureExpenses([
      ["Entertainment", 40000, "2026-08-20", "paid"],
      ["Transport", 30000, "2026-09-05"],
      ["Salary", 500000, "2026-08-05"],
    ]);
    render(<NeedsFundingSection month="2026-08" />);

    expect(gapNames()).toEqual([
      "Rent",
      "Utilities",
      "Groceries",
      "Entertainment",
      "Transport",
    ]);
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
    const entertainmentRow = screen.getByText("Entertainment").closest("li")!;
    expect(within(entertainmentRow).getAllByText("$0.00")).toHaveLength(3);
  });

  it("renders Allocated, Needed, Missing and progress for each gap", () => {
    seedTypicalGaps();
    render(<NeedsFundingSection month="2026-08" />);

    const rentRow = screen.getByText("Rent").closest("li")!;
    expect(within(rentRow).getByText("$0.00")).toBeInTheDocument();
    expect(within(rentRow).getAllByText("$1,500.00")).toHaveLength(2);
    expect(within(rentRow).getByText("Allocated")).toBeInTheDocument();
    expect(within(rentRow).getByText("Needed")).toBeInTheDocument();
    expect(within(rentRow).getByText("Missing")).toBeInTheDocument();
    expect(within(rentRow).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(within(rentRow).getByText("0%")).toBeInTheDocument();
  });

  it("accounts for partial budgets: allocated counts toward the target", () => {
    seedTypicalGaps();
    useAppStore.getState().addBudget({
      categoryId: categoryId("Groceries"),
      month: "2026-08",
      limit: 20000,
      priority: "medium",
    });
    render(<NeedsFundingSection month="2026-08" />);

    const groceriesRow = screen.getByText("Groceries").closest("li")!;
    expect(within(groceriesRow).getByText("$200.00")).toBeInTheDocument();
    expect(within(groceriesRow).getByText("$500.00")).toBeInTheDocument();
    expect(within(groceriesRow).getByText("$300.00")).toBeInTheDocument();
    expect(within(groceriesRow).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(within(groceriesRow).getByText("40%")).toBeInTheDocument();
  });

  it("hides categories fully covered by their budget", () => {
    seedTypicalGaps();
    useAppStore.getState().addBudget({
      categoryId: categoryId("Rent"),
      month: "2026-08",
      limit: 150000,
      priority: "high",
    });
    render(<NeedsFundingSection month="2026-08" />);

    expect(gapNames()).toEqual([
      "Utilities",
      "Groceries",
      "Entertainment",
      "Transport",
    ]);
  });

  it("shows the empty state when every expense category has a budget", () => {
    seedTypicalGaps();
    for (const [name, amount] of [
      ["Rent", 150000],
      ["Utilities", 80000],
      ["Groceries", 50000],
      ["Entertainment", 1],
      ["Transport", 1],
    ] as const) {
      useAppStore.getState().addBudget({
        categoryId: categoryId(name),
        month: "2026-08",
        limit: amount,
        priority: "medium",
      });
    }

    render(<NeedsFundingSection month="2026-08" />);

    expect(screen.getByText(/Everything is funded/)).toBeInTheDocument();
    expect(
      screen.getByText(/Every expense category has a budget this month/),
    ).toBeInTheDocument();
  });

  it("attentionOnly preview shows the top 3 gaps and a view-all affordance", () => {
    seedTypicalGaps();
    seedFutureExpenses([["Entertainment", 30000, "2026-08-30"]]);
    render(
      <NeedsFundingSection month="2026-08" attentionOnly onExpand={vi.fn()} />,
    );

    expect(gapNames()).toEqual(["Rent", "Utilities", "Groceries"]);
    expect(
      screen.getByRole("button", { name: /View all 5 categories/ }),
    ).toBeInTheDocument();
  });

  it("Fund opens the budget form preselected and prefilled with the missing amount", async () => {
    const user = userEvent.setup();
    seedTypicalGaps();
    render(<NeedsFundingSection month="2026-08" />);

    const rentRow = screen.getByText("Rent").closest("li")!;
    await user.click(within(rentRow).getByRole("button", { name: "Fund" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("New budget")).toBeInTheDocument();
    const categorySelect = within(dialog).getByLabelText(
      "Category",
    ) as HTMLSelectElement;
    expect(categorySelect.value).toBe(categoryId("Rent"));
    const limitInput = within(dialog).getByLabelText("Limit") as HTMLInputElement;
    expect(limitInput.value).toBe("1500");
  });

  it("saving the budget dispatches planner:focus-budget for the new budget", async () => {
    const user = userEvent.setup();
    seedTypicalGaps();
    const focusSpy = vi.fn();
    window.addEventListener("planner:focus-budget", focusSpy);

    render(<NeedsFundingSection month="2026-08" />);
    const rentRow = screen.getByText("Rent").closest("li")!;
    await user.click(within(rentRow).getByRole("button", { name: "Fund" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add budget" }));

    const { state } = useAppStore.getState();
    const rentBudget = state.budgets.find(
      (budget) => budget.categoryId === categoryId("Rent"),
    );
    expect(rentBudget?.limit).toBe(150000);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    const detail = (focusSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.budgetId).toBe(rentBudget!.id);
    window.removeEventListener("planner:focus-budget", focusSpy);
  });

  it("Fund with an existing budget jumps straight to it without a dialog", async () => {
    const user = userEvent.setup();
    seedTypicalGaps();
    useAppStore.getState().addBudget({
      categoryId: categoryId("Groceries"),
      month: "2026-08",
      limit: 20000,
      priority: "medium",
    });
    const focusSpy = vi.fn();
    window.addEventListener("planner:focus-budget", focusSpy);

    render(<NeedsFundingSection month="2026-08" />);
    const groceriesRow = screen.getByText("Groceries").closest("li")!;
    await user.click(within(groceriesRow).getByRole("button", { name: "Fund" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    const detail = (focusSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.budgetId).toBe(
      useAppStore
        .getState()
        .state.budgets.find((budget) => budget.categoryId === categoryId("Groceries"))!
        .id,
    );
    window.removeEventListener("planner:focus-budget", focusSpy);
  });

  it("funding a category removes it from the list and persists the budget", async () => {
    const user = userEvent.setup();
    seedTypicalGaps();
    render(<NeedsFundingSection month="2026-08" />);

    const rentRow = screen.getByText("Rent").closest("li")!;
    await user.click(within(rentRow).getByRole("button", { name: "Fund" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add budget" }));

    const { state } = useAppStore.getState();
    expect(
      state.budgets.some(
        (budget) =>
          budget.categoryId === categoryId("Rent") &&
          budget.month === "2026-08",
      ),
    ).toBe(true);
    expect(gapNames()).toEqual([
      "Utilities",
      "Groceries",
      "Entertainment",
      "Transport",
    ]);
  });

  it("shows a category+expense created after mount and funds it end-to-end, expanding and highlighting the budget list", async () => {
    const user = userEvent.setup();
    const state = useAppStore.getState().state;
    const incomePlan: IncomePlan = {
      id: "plan-1",
      month: "2026-08",
      name: "Salary",
      icon: "💰",
      expectedAmount: 100000,
      receivedAmount: 100000,
    };
    useAppStore.setState({ state: { ...state, incomePlans: [incomePlan] } });

    render(
      <>
        <Disclosure
          id="needs-funding:2026-08"
          title="Needs funding"
          preview={(toggle) => (
            <NeedsFundingSection
              month="2026-08"
              attentionOnly
              onExpand={toggle}
            />
          )}
        >
          <NeedsFundingSection month="2026-08" />
        </Disclosure>
        <BudgetList month="2026-08" />
      </>,
    );

    await act(async () => {
      useAppStore.getState().addCategory({
        name: "Dog food",
        icon: "🐶",
        color: "#7c3aed",
        kind: "expense",
      });
      useAppStore.getState().addFutureExpense({
        categoryId: categoryId("Dog food"),
        amount: 45000,
        title: "Dog food",
        dueDate: "2026-08-10",
      });
    });

    expect(screen.getByText("Dog food")).toBeInTheDocument();

    const dogFoodRow = screen.getByText("Dog food").closest("li")!;
    await user.click(
      within(dogFoodRow).getByRole("button", { name: "Fund" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByLabelText("Category") as HTMLSelectElement).value,
    ).toBe(categoryId("Dog food"));
    expect(
      (within(dialog).getByLabelText("Limit") as HTMLInputElement).value,
    ).toBe("450");
    await user.click(within(dialog).getByRole("button", { name: "Add budget" }));

    const { state: after } = useAppStore.getState();
    const created = after.budgets.find(
      (budget) =>
        budget.month === "2026-08" &&
        budget.categoryId === categoryId("Dog food"),
    );
    expect(created?.limit).toBe(45000);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Budget Allocation/ }),
      ).toHaveAttribute("aria-expanded", "true"),
    );
    const row = document.getElementById(`budget-row-${created!.id}`);
    expect(row).toBeTruthy();
    expect(row).toHaveClass("ring-2");
  });
});
