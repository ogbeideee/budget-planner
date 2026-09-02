import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { todayIso } from "@/lib/date";
import { checkAnomaly } from "@/lib/anomalies";
import { createInitialState } from "@/lib/seed";
import { totals } from "@/lib/selectors";
import { useAppStore } from "@/store/useAppStore";
import { QuickAddPanel } from "./QuickAddPanel";

// The tray quick-add window (FR-26). What these tests are really protecting is
// requirement 3: a quick-added transaction must be INDISTINGUISHABLE from one
// added through the main window's Add Expense flow, because it goes through the
// same store action rather than a second write path of its own.

const close = vi.fn();
const announce = vi.fn(() => Promise.resolve());

vi.mock("@/lib/desktopFeatures", () => ({
  closeQuickAddWindow: () => close(),
  announceQuickAddSaved: () => announce(),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function expenseCategoryId(): string {
  return useAppStore
    .getState()
    .state.categories.find((category) => category.kind === "expense")!.id;
}

async function quickAdd(amount: string, note?: string) {
  const user = userEvent.setup();
  render(<QuickAddPanel />);
  await user.selectOptions(
    screen.getByLabelText("Category"),
    expenseCategoryId(),
  );
  await user.type(screen.getByLabelText("Amount"), amount);
  if (note !== undefined) {
    await user.type(screen.getByLabelText("Note (optional)"), note);
  }
  await user.click(screen.getByRole("button", { name: "Save expense" }));
  return user;
}

describe("QuickAddPanel (FR-26)", () => {
  it("writes through the shared addTransaction action (req 3)", async () => {
    // Spying on the store action is the direct assertion that quick-add reuses
    // it rather than reimplementing a write.
    const addTransaction = vi.spyOn(useAppStore.getState(), "addTransaction");
    await quickAdd("12.50", "Coffee");

    expect(addTransaction).toHaveBeenCalledTimes(1);
    expect(addTransaction).toHaveBeenCalledWith({
      categoryId: expenseCategoryId(),
      amount: 1250,
      type: "expense",
      date: todayIso(),
      note: "Coffee",
    });
  });

  it("produces a transaction the rest of the app treats normally", async () => {
    await quickAdd("12.50", "Coffee");

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    const added = state.transactions[0];
    expect(added.amount).toBe(1250);
    expect(added.type).toBe("expense");
    expect(added.categoryId).toBe(expenseCategoryId());
    expect(added.note).toBe("Coffee");
    // Carries the same generated fields every other transaction has, so the
    // ledger cannot tell where it came from.
    expect(added.id).toBeTruthy();
    expect(added.createdAt).toBeTruthy();

    // And the downstream engines count it with no special casing: it lands in
    // the month totals, and anomaly detection sees it as spending history for
    // its category the same way a hand-entered row would.
    expect(totals(state.transactions, added.date.slice(0, 7)).expenses).toBe(
      1250,
    );
    expect(
      checkAnomaly(state.transactions, {
        categoryId: added.categoryId,
        amount: 5000,
      }).priorCount,
    ).toBe(1);
  });

  it("omits an empty note rather than storing a blank string", async () => {
    await quickAdd("5", "   ");
    expect(useAppStore.getState().state.transactions[0].note).toBeUndefined();
  });

  it("announces the save so an open main window rehydrates (req 5)", async () => {
    await quickAdd("12.50");
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("confirms, then closes itself (req 4)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await quickAdd("12.50");
      // Confirmation first...
      expect(await screen.findByRole("status")).toHaveTextContent("added");
      expect(close).not.toHaveBeenCalled();
      // ...then the window closes on its own.
      await vi.advanceTimersByTimeAsync(1000);
      await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a zero or malformed amount without writing", async () => {
    const user = userEvent.setup();
    render(<QuickAddPanel />);
    await user.selectOptions(
      screen.getByLabelText("Category"),
      expenseCategoryId(),
    );
    await user.type(screen.getByLabelText("Amount"), "0");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(useAppStore.getState().state.transactions).toHaveLength(0);
    expect(screen.getByText(/amount greater than 0/i)).toBeTruthy();
    expect(announce).not.toHaveBeenCalled();
  });

  it("requires a category before writing", async () => {
    const user = userEvent.setup();
    render(<QuickAddPanel />);
    await user.type(screen.getByLabelText("Amount"), "12.50");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(useAppStore.getState().state.transactions).toHaveLength(0);
    expect(screen.getByText("Choose a category.")).toBeTruthy();
  });

  it("offers expense categories only", async () => {
    render(<QuickAddPanel />);
    const options = Array.from(
      screen.getByLabelText("Category").querySelectorAll("option"),
    ).map((option) => option.value);
    const incomeIds = new Set(
      useAppStore
        .getState()
        .state.categories.filter((category) => category.kind === "income")
        .map((category) => category.id),
    );
    expect(incomeIds.size).toBeGreaterThan(0);
    expect(options.some((value) => incomeIds.has(value))).toBe(false);
  });

  it("explains itself instead of offering an empty picker", async () => {
    useAppStore.setState({
      state: {
        ...useAppStore.getState().state,
        categories: useAppStore
          .getState()
          .state.categories.filter((category) => category.kind === "income"),
      },
    });
    render(<QuickAddPanel />);
    expect(screen.getByText("No expense categories yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save expense" })).toBeNull();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<QuickAddPanel />);
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledTimes(1);
  });
});
