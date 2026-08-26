import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { useDisplayName } from "@/store/useDisplayName";
import { Hero } from "./Hero";
import { REVIEW_BUDGETS_HREF } from "./reviewBudgets";
import type { IncomePlan } from "@/lib/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 13, 15, 0));
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
  useDisplayName.setState({ name: null });
  pushMock.mockClear();
});

function seedStats() {
  const state = useAppStore.getState().state;
  const rent = state.categories.find((c) => c.name === "Rent")!;
  const groceries = state.categories.find((c) => c.name === "Groceries")!;
  const incomePlan: IncomePlan = {
    id: "plan-1",
    month: "2026-08",
    name: "Salary",
    icon: "💰",
    expectedAmount: 100000,
    receivedAmount: 62000,
  };
  const now = new Date().toISOString();
  useAppStore.setState({
    state: {
      ...state,
      incomePlans: [incomePlan],
      transactions: [
        {
          id: "t1",
          type: "expense",
          categoryId: rent.id,
          amount: 50000,
          date: "2026-08-02",
          note: "August rent",
          createdAt: now,
        },
        {
          id: "t2",
          type: "expense",
          categoryId: groceries.id,
          amount: 20000,
          date: "2026-08-05",
          createdAt: now,
        },
      ],
    },
  });
}

describe("Hero monthly overview", () => {
  it("shows the current date and an afternoon greeting with the saved name", () => {
    seedStats();
    useDisplayName.setState({ name: "Daniel" });
    render(<Hero month="2026-08" />);

    expect(screen.getByText("Thursday, August 13")).toBeInTheDocument();
    expect(screen.getByText(/Good afternoon, Daniel/)).toBeInTheDocument();
  });

  it("greets without a name when none has been saved", () => {
    seedStats();
    render(<Hero month="2026-08" />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Good afternoon👋");
  });

  it("shows the projected remaining balance sentence", () => {
    seedStats();
    render(<Hero month="2026-08" />);

    expect(screen.getByText(/\$300\.00/)).toBeInTheDocument();
    expect(
      screen.getByText(/on track to finish August with/),
    ).toBeInTheDocument();
  });

  it("shows days remaining with the daily available amount", () => {
    seedStats();
    render(<Hero month="2026-08" />);

    expect(screen.getByText("18 days remaining")).toBeInTheDocument();
    expect(screen.getByText("$16.67/day available")).toBeInTheDocument();
  });

  it("shows the expected income received percentage with a thin progress bar", () => {
    seedStats();
    const { container } = render(<Hero month="2026-08" />);

    expect(
      screen.getByText("62% of expected income received"),
    ).toBeInTheDocument();
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute("aria-valuenow")).toBe("62");
  });

  it("renders Review Budget and View Reports actions", () => {
    seedStats();
    render(<Hero month="2026-08" />);

    expect(
      screen.getByRole("button", { name: "Review Budget" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View Reports" }),
    ).toBeInTheDocument();
  });

  it("sends Review Budget to the same destination as the status band", () => {
    seedStats();
    const section = document.createElement("section");
    section.id = "budget-allocation";
    const scrollIntoView = vi.fn();
    section.scrollIntoView = scrollIntoView;
    document.body.appendChild(section);

    render(<Hero month="2026-08" />);
    screen.getByRole("button", { name: "Review Budget" }).click();

    expect(pushMock).toHaveBeenCalledWith(REVIEW_BUDGETS_HREF);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    section.remove();
  });

  it("prompts for expected income when none is set", () => {
    render(<Hero month="2026-08" />);

    expect(
      screen.getByText("Set your expected income to start planning this month."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Set expected income to begin")).toHaveLength(2);
  });

  it("flags a projected shortfall at month-end", () => {
    seedStats();
    const state = useAppStore.getState().state;
    useAppStore.setState({
      state: {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === "t2" ? { ...t, amount: 90000 } : t,
        ),
      },
    });
    render(<Hero month="2026-08" />);

    expect(screen.getByText(/short by/)).toBeInTheDocument();
    expect(screen.getByText("$400.00")).toBeInTheDocument();
  });

  it("reports a complete month for past months", () => {
    seedStats();
    render(<Hero month="2026-06" />);

    expect(screen.getByText("0 days remaining")).toBeInTheDocument();
    expect(screen.getByText("Month complete")).toBeInTheDocument();
  });
});