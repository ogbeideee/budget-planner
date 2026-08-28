import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { todayIso } from "@/lib/date";
import { createInitialState } from "@/lib/seed";
import { addDaysIso } from "@/lib/recurringPatterns";
import { useAppStore } from "@/store/useAppStore";
import { TransactionForm } from "./TransactionForm";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function expenseCategoryId(index = 0): string {
  return (
    useAppStore
      .getState()
      .state.categories.filter((category) => category.kind === "expense")[
      index
    ].id
  );
}

/**
 * Seeds a weekly ₦5,000.00 pattern (3 occurrences) ending 2 days ago, so its
 * next projected occurrence is +5 days — inside the due window today.
 */
function seedWeeklyPattern(categoryId: string): string {
  const today = todayIso();
  const store = useAppStore.getState();
  const offsets = [-16, -9, -2];
  offsets.forEach((offset, i) =>
    store.addTransaction({
      categoryId,
      amount: 500000,
      type: "expense",
      date: addDaysIso(today, offset),
      note: i === offsets.length - 1 ? "DSTV subscription" : undefined,
    }),
  );
  return addDaysIso(today, 5);
}

describe("TransactionForm — recurring quick-fill (FR-25)", () => {
  it("pre-fills the full entry when a suggestion is confirmed WITHOUT saving", async () => {
    const user = userEvent.setup();
    const categoryId = expenseCategoryId(0);
    const nextExpected = seedWeeklyPattern(categoryId);

    render(<TransactionForm open onClose={() => {}} />);

    // The suggestion renders as a hint with the exact requested wording.
    expect(screen.getByTestId("recurring-quickfill").textContent).toMatch(
      /recurring .* payment of .*5,000\.00/,
    );

    await user.click(screen.getByRole("button", { name: "Fill in" }));

    // Everything pre-filled for confirmation...
    expect(
      (screen.getByLabelText("Amount") as HTMLInputElement).value,
    ).toBe("5000");
    expect(
      (screen.getByLabelText("Category") as HTMLSelectElement).value,
    ).toBe(categoryId);
    expect((screen.getByLabelText("Note (optional)") as HTMLTextAreaElement).value).toBe(
      "DSTV subscription",
    );
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
      nextExpected,
    );

    // ...and NOTHING was saved by confirming.
    expect(useAppStore.getState().state.transactions).toHaveLength(3);

    // The user still confirms through the ordinary submit path.
    await user.click(screen.getByRole("button", { name: "Add Expense" }));
    const transactions = useAppStore.getState().state.transactions;
    expect(transactions).toHaveLength(4);
    const added = transactions.find(
      (transaction) => transaction.amount === 500000,
    )!;
    expect(added.categoryId).toBe(categoryId);
    expect(added.note).toBe("DSTV subscription");
    expect(added.date).toBe(nextExpected);
  });

  it("shows no suggestion when no due pattern exists", () => {
    render(<TransactionForm open onClose={() => {}} />);
    expect(screen.queryByTestId("recurring-quickfill")).toBeNull();
  });
});

describe("TransactionForm — anomaly note (FR-25)", () => {
  it("shows a dismissible note when the amount is ~3x the category average", async () => {
    const user = userEvent.setup();
    const categoryId = expenseCategoryId(0);
    const store = useAppStore.getState();
    // Deliberately irregular gaps so nothing counts as a recurring pattern.
    [-95, -75, -35, -5].forEach((offset) =>
      store.addTransaction({
        categoryId,
        amount: 100000,
        type: "expense",
        date: addDaysIso(todayIso(), offset),
      }),
    );

    render(<TransactionForm open onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("Category"), categoryId);
    await user.type(screen.getByLabelText("Amount"), "3000.00"); // 300000 = 3x

    const note = screen.getByRole("note");
    expect(note.textContent).toContain(
      `This is notably higher than your usual`,
    );

    // Dismissing clears it without blocking anything; saving still works.
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("note")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add Expense" }));
    expect(useAppStore.getState().state.transactions).toHaveLength(5);
  });

  it("stays silent for a category with insufficient history", async () => {
    const user = userEvent.setup();
    // A second expense category with at most 2 prior entries.
    const categoryId = expenseCategoryId(1);
    useAppStore.getState().addTransaction({
      categoryId,
      amount: 100000,
      type: "expense",
      date: addDaysIso(todayIso(), -10),
    });

    render(<TransactionForm open onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("Category"), categoryId);
    await user.type(screen.getByLabelText("Amount"), "5000.00");

    expect(screen.queryByRole("note")).toBeNull();
  });

  it("never fires on the transfer tab (anomaly is an expense-only signal)", async () => {
    const user = userEvent.setup();
    const categoryId = expenseCategoryId(0);
    const store = useAppStore.getState();
    [-35, -65, -95].forEach((offset) =>
      store.addTransaction({
        categoryId,
        amount: 100000,
        type: "expense",
        date: addDaysIso(todayIso(), offset),
      }),
    );

    render(<TransactionForm open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));
    await user.selectOptions(screen.getByLabelText("Category"), categoryId);
    await user.type(screen.getByLabelText("Amount"), "9999.00");

    expect(screen.queryByRole("note")).toBeNull();
  });
});
