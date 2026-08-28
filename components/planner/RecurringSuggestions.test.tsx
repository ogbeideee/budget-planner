import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { monthKeyFromIso, todayIso } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { addDaysIso } from "@/lib/recurringPatterns";
import { createInitialState } from "@/lib/seed";
import type { TransactionPrefill } from "@/lib/types";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { RecurringSuggestions } from "./RecurringSuggestions";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

/** Weekly ₦5,000 pattern ending 2 days ago; next projection lands at +5d. */
function seedWeeklyPattern() {
  const categoryId = useAppStore
    .getState()
    .state.categories.find((category) => category.kind === "expense")!.id;
  const today = todayIso();
  [-16, -9, -2].forEach((offset) =>
    useAppStore.getState().addTransaction({
      categoryId,
      amount: 500000,
      type: "expense",
      date: addDaysIso(today, offset),
      note: "DSTV subscription",
    }),
  );
  return {
    categoryId,
    expectedAmount: 500000,
    nextExpectedDate: addDaysIso(today, 5),
  };
}

describe("RecurringSuggestions (FR-25)", () => {
  it("lists due patterns for the viewed month with amount, cadence and date", () => {
    const seeded = seedWeeklyPattern();
    const month = monthKeyFromIso(seeded.nextExpectedDate);
    render(<RecurringSuggestions month={month} onQuickAdd={() => {}} />);

    expect(screen.getByText("Recurring payments")).toBeTruthy();
    const category = useAppStore
      .getState()
      .state.categories.find((c) => c.id === seeded.categoryId)!;
    expect(
      screen.getByText(categoryDisplay(category).name),
    ).toBeTruthy();
    // Expected amount formatted through formatMoney with the store currency.
    expect(
      screen.getByText(
        formatMoney(seeded.expectedAmount, useAppStore.getState().state.settings.currency),
        { exact: false },
      ),
    ).toBeTruthy();
    expect(screen.getByText(/every week/i)).toBeTruthy();
  });

  it("hands a full prefill to onQuickAdd and saves nothing itself", () => {
    const seeded = seedWeeklyPattern();
    const month = monthKeyFromIso(seeded.nextExpectedDate);
    const onQuickAdd = vi.fn<(prefill: TransactionPrefill) => void>();
    render(<RecurringSuggestions month={month} onQuickAdd={onQuickAdd} />);

    const before = useAppStore.getState().state.transactions.length;
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    expect(onQuickAdd).toHaveBeenCalledWith({
      categoryId: seeded.categoryId,
      amountMinor: seeded.expectedAmount,
      date: seeded.nextExpectedDate,
      note: "DSTV subscription",
    });
    expect(useAppStore.getState().state.transactions.length).toBe(before);
  });

  it("renders nothing when no pattern projects into the viewed month", () => {
    seedWeeklyPattern();
    const farMonth = monthKeyFromIso(addDaysIso(todayIso(), 120));
    const { container } = render(
      <RecurringSuggestions month={farMonth} onQuickAdd={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
