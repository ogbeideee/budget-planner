import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type { IncomePlan, Month, Transaction } from "@/lib/types";
import { IncomeComparisonChart } from "./IncomeComparisonChart";

const MONTHS: Month[] = [
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
];
const MONTH: Month = "2026-08";

beforeAll(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    window.matchMedia = ((query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  }
});

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

/** Two income sources in the current month, plus a received transaction. */
function seedIncome() {
  const state = useAppStore.getState().state;
  const salaryCategory = state.categories.find((c) => c.kind === "income")!;
  const plans: IncomePlan[] = [
    {
      id: "plan-salary",
      month: MONTH,
      name: "Salary",
      icon: "💰",
      expectedAmount: 400000,
      receivedAmount: 400000,
    },
    {
      id: "plan-forex",
      month: MONTH,
      name: "Forex",
      icon: "💱",
      expectedAmount: 100000,
      receivedAmount: 40000,
    },
  ];
  const transactions: Transaction[] = [
    {
      id: "t1",
      type: "income",
      categoryId: salaryCategory.id,
      amount: 400000,
      date: `${MONTH}-03`,
      createdAt: new Date().toISOString(),
    },
  ];
  useAppStore.setState({
    state: { ...state, incomePlans: plans, transactions },
  });
}

function render_() {
  return render(<IncomeComparisonChart month={MONTH} months={MONTHS} />);
}

function viewLabel(): string {
  return screen.getByRole("img").getAttribute("aria-label") ?? "";
}

describe("IncomeComparisonChart card", () => {
  it("is one card with a single title and a two-option view toggle", () => {
    seedIncome();
    const { container } = render_();

    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(
      screen.getByText("Income: expected vs received"),
    ).toBeInTheDocument();

    const group = screen.getByRole("group", { name: "Income comparison view" });
    const buttons = Array.from(group.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual([
      "By source",
      "Over time",
    ]);
  });

  it("defaults to By source, since the page opens on the current month", () => {
    seedIncome();
    render_();

    expect(
      screen.getByRole("button", { name: "By source" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Over time" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("This month, by source")).toBeInTheDocument();
  });
});

describe("IncomeComparisonChart: By source view", () => {
  it("describes each income source's expected vs received for the month", () => {
    seedIncome();
    render_();

    const label = viewLabel();
    expect(label).toContain("by source");
    expect(label).toContain("Salary expected $4,000.00, received $4,000.00");
    expect(label).toContain("Forex expected $1,000.00, received $400.00");
  });

  it("shows its own empty state when nothing is planned or received", () => {
    render_();

    expect(screen.getByText("No income planned or received")).toBeInTheDocument();
    // The toggle stays reachable so the other view is still one click away.
    expect(
      screen.getByRole("group", { name: "Income comparison view" }),
    ).toBeInTheDocument();
  });
});

describe("IncomeComparisonChart: Over time view", () => {
  it("switches to the six-month trend of the same comparison", async () => {
    const user = userEvent.setup();
    seedIncome();
    render_();

    await user.click(screen.getByRole("button", { name: "Over time" }));

    expect(
      screen.getByRole("button", { name: "Over time" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Last 6 months")).toBeInTheDocument();

    const label = viewLabel();
    expect(label).toContain("over time");
    // One point per month in the window, still expected vs received.
    for (const short of ["Mar", "Apr", "May", "Jun", "Jul", "Aug"]) {
      expect(label).toContain(short);
    }
    expect(label).toContain("expected");
    expect(label).toContain("received");
  });

  it("shows its own empty state and can switch back", async () => {
    const user = userEvent.setup();
    render_();

    await user.click(screen.getByRole("button", { name: "Over time" }));
    expect(screen.getByText("No income to chart yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "By source" }));
    expect(screen.getByText("No income planned or received")).toBeInTheDocument();
  });
});

describe("IncomeComparisonChart legend", () => {
  it("keeps the same Expected/Received keys in both views", async () => {
    const user = userEvent.setup();
    seedIncome();
    render_();

    const legendIn = () => {
      const expected = screen.getByText("Expected");
      const received = screen.getByText("Received");
      return {
        expectedDot: expected.querySelector("span")!.className,
        receivedStyle: received
          .querySelector("span")!
          .getAttribute("style"),
      };
    };

    const bySource = legendIn();
    await user.click(screen.getByRole("button", { name: "Over time" }));
    const overTime = legendIn();

    // Same swatch treatment either side of the toggle: Expected on the border
    // token, Received on the income colour.
    expect(bySource.expectedDot).toContain("bg-border");
    expect(overTime.expectedDot).toBe(bySource.expectedDot);
    expect(overTime.receivedStyle).toBe(bySource.receivedStyle);
  });
});
