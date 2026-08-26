import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { ExpenseDetailsView } from "./ExpenseDetailsView";

const backMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock, replace: replaceMock, push: pushMock }),
  usePathname: () => "/history/expense/t1",
  useSearchParams: () => new URLSearchParams(),
}));

const CATEGORY_ID = "cat-rent";
const CREATED_AT = new Date(2026, 7, 15, 9, 5).toISOString();

afterEach(cleanup);

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, "length", {
    configurable: true,
    get: () => length,
  });
}

beforeEach(() => {
  setHistoryLength(1);
  window.localStorage.clear();
  const state = createInitialState();
  state.categories = [
    {
      id: CATEGORY_ID,
      name: "Rent",
      icon: "🏠",
      color: "#ef4444",
      kind: "expense",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    ...state.categories.filter((category) => category.kind === "income"),
  ];
  state.transactions = [
    {
      id: "t1",
      type: "expense",
      categoryId: CATEGORY_ID,
      amount: 5000,
      date: "2026-08-15",
      note: "August rent",
      createdAt: CREATED_AT,
    },
  ];
  useAppStore.setState({ state });
  backMock.mockClear();
  replaceMock.mockClear();
  pushMock.mockClear();
});

function renderView(expenseId = "t1") {
  render(<ExpenseDetailsView expenseId={expenseId} />);
}

describe("ExpenseDetailsView", () => {
  it("renders the header with back navigation and an Edit action", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "Expense Details" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to Timeline" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit expense" })).toBeInTheDocument();
  });

  it("prominently shows the name, category and amount", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "August rent" })).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("Saturday, August 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("9:05 AM")).toBeInTheDocument();
  });

  it("shows the note and every detail row", () => {
    renderView();

    expect(screen.getAllByText("August rent").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Payment method")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.getByText("Receipt")).toBeInTheDocument();
    expect(screen.getByText("Not attached")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Aug 15, 2026 · 9:05 AM")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("No budget set")).toBeInTheDocument();
  });

  it("shows the budget limit and spent when a budget exists", () => {
    const state = useAppStore.getState().state;
    state.budgets = [
      {
        id: "b1",
        categoryId: CATEGORY_ID,
        month: "2026-08",
        limit: 40000,
        priority: "high",
      },
    ];
    useAppStore.setState({ state });
    renderView();

    expect(
      screen.getByText("$400.00 limit · $50.00 spent"),
    ).toBeInTheDocument();
  });

  it("flags a record that was edited after creation", () => {
    const state = useAppStore.getState().state;
    state.transactions[0].edited = true;
    useAppStore.setState({ state });
    renderView();

    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("opens the edit form from the Edit Expense action", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Edit Expense" }));

    expect(screen.getByRole("heading", { name: "Edit transaction" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Amount/ }),
    ).toHaveValue("50");
  });

  it("deletes the expense through the confirm dialog", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Delete Expense" }));
    expect(
      screen.getByText("Delete this expense? This cannot be undone."),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete expense",
      }),
    );

    expect(
      useAppStore.getState().state.transactions.find((t) => t.id === "t1"),
    ).toBeUndefined();
    expect(screen.getByText("Expense not found")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/history?month=2026-08");
  });

  it("falls back to the timeline month on direct entry", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Back to Timeline" }));

    expect(replaceMock).toHaveBeenCalledWith("/history?month=2026-08");
  });

  it("walks back to the previous page when history exists", async () => {
    setHistoryLength(3);
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Back to Timeline" }));

    expect(backMock).toHaveBeenCalledTimes(1);
    setHistoryLength(1);
  });

  it("shows a not-found state for unknown or income ids", () => {
    renderView("unknown-id");
    expect(screen.getByText("Expense not found")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Expense Details" })).toBeInTheDocument();
  });
});