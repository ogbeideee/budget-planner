import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { monthKeyFromIso, todayIso } from "@/lib/date";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { HistoryView } from "./HistoryView";

const params = vi.hoisted(() => new URLSearchParams());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/history",
  useSearchParams: () => params,
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
  params.delete("month");
  params.set("month", monthKeyFromIso(todayIso()));
});

describe("HistoryView summary chips", () => {
  it("renders the header with the spec description", () => {
    render(<HistoryView />);
    expect(
      screen.getByText("Review every transaction and understand your financial journey."),
    ).toBeInTheDocument();
  });

  it("summarizes the month across four chips", () => {
    const state = useAppStore.getState().state;
    const now = new Date().toISOString();
    useAppStore.setState({
      state: {
        ...state,
        transactions: [
          {
            id: "t1",
            type: "income" as const,
            categoryId: state.categories[0].id,
            amount: 90000,
            date: todayIso(),
            createdAt: now,
          },
          {
            id: "t2",
            type: "expense" as const,
            categoryId: state.categories[0].id,
            amount: 20000,
            date: todayIso(),
            createdAt: now,
          },
          {
            id: "t3",
            type: "expense" as const,
            categoryId: state.categories[0].id,
            amount: 10000,
            date: todayIso(),
            deferred: true,
            createdAt: now,
          },
          {
            id: "t4",
            type: "expense" as const,
            categoryId: state.categories[0].id,
            amount: 5000,
            date: todayIso(),
            createdAt: now,
          },
        ],
      },
    });
    render(<HistoryView />);

    const summary = screen.getByLabelText("Month summary");
    expect(within(summary).getByText("Income")).toBeInTheDocument();
    expect(within(summary).getByText("$900.00")).toBeInTheDocument();
    expect(within(summary).getByText("Expenses")).toBeInTheDocument();
    expect(within(summary).getByText("$350.00")).toBeInTheDocument();
    expect(within(summary).getByText("Transfers")).toBeInTheDocument();
    expect(within(summary).getByText("$100.00")).toBeInTheDocument();
    expect(within(summary).getByText("Transactions")).toBeInTheDocument();
    expect(within(summary).getByText("4")).toBeInTheDocument();
  });
});
