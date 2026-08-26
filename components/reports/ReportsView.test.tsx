import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { currentMonthKey, monthOffset } from "@/lib/date";
import { ReportsView } from "./ReportsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams(),
}));

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

describe("ReportsView", () => {
  it("keeps the original header and section order with the new breakdown sections", () => {
    render(<ReportsView />);

    expect(
      screen.getByRole("heading", { name: "Reports" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Understand your spending patterns and financial trends."),
    ).toBeInTheDocument();

    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    const order = [
      "Reports",
      "Monthly overview",
      "Financial insights",
      "Spending breakdown",
      "Savings trend",
      "Spending trend",
      "Cash flow",
      "Forecast",
      "Recommendations",
      "Detailed breakdowns",
    ];
    const indices = order.map((label) => headings.indexOf(label));
    for (let index = 1; index < indices.length; index += 1) {
      expect(indices[index]).toBeGreaterThan(indices[index - 1]);
    }
  });

  // Consolidation: the page carries exactly ONE category breakdown, the
  // Category analysis donut + list, and it lives beside Income vs expenses in
  // the Spending breakdown section.
  it("keeps exactly one category breakdown, inside Spending breakdown", () => {
    render(<ReportsView />);

    expect(screen.queryByText("Spending by category")).not.toBeInTheDocument();
    expect(screen.queryByText("Top categories")).not.toBeInTheDocument();
    // The card keeps its own title; what went away is the standalone section
    // heading that used to sit further down the page.
    const titles = screen.getAllByText("Category analysis");
    expect(titles).toHaveLength(1);

    const breakdown = screen
      .getByRole("heading", { name: "Spending breakdown" })
      .closest("section")!;
    expect(breakdown).toBeTruthy();
    expect(within(breakdown).getByText("Category analysis")).toBeInTheDocument();
  });

  it("no longer renders the moved Spending this month card", () => {
    render(<ReportsView />);

    expect(screen.queryByText("Spending this month")).not.toBeInTheDocument();
  });
});
describe("Minimum-history gating for trend charts", () => {
  const NOW = currentMonthKey();
  const PREV = monthOffset(NOW, -1);

  /** Budgets + spending in each given month, so each counts as real history. */
  function seedMonths(monthsToSeed: string[]) {
    const state = useAppStore.getState().state;
    const category = state.categories.find((c) => c.kind === "expense")!;
    useAppStore.setState({
      state: {
        ...state,
        budgets: monthsToSeed.map((m, i) => ({
          id: `b-${i}`,
          categoryId: category.id,
          month: m as never,
          limit: 100000,
          priority: "medium" as const,
        })),
        transactions: monthsToSeed.map((m, i) => ({
          id: `t-${i}`,
          type: "expense" as const,
          categoryId: category.id,
          amount: 50000,
          date: `${m}-05`,
          createdAt: new Date().toISOString(),
        })),
      },
    });
  }

  /**
   * These charts are dynamically imported, so under jsdom they mount as a
   * ChartSkeleton rather than the real chart. Counting skeletons inside a
   * section is therefore how we observe whether a chart is in the layout.
   */
  function chartsIn(headingName: string): number {
    const section = screen
      // "Cash flow" is both a section heading and a card title; the section
      // heading comes first in the DOM.
      .getAllByRole("heading", { name: headingName })[0]
      .closest("section")!;
    return section.querySelectorAll(".animate-pulse").length;
  }

  it("omits Budget utilization entirely with only one month of history", () => {
    seedMonths([NOW]);
    render(<ReportsView />);

    // Not a placeholder, not an empty state — gone from the layout.
    expect(chartsIn("Detailed breakdowns")).toBe(0);
  });

  it("still shows the one-month banner when the chart is hidden", () => {
    seedMonths([NOW]);
    render(<ReportsView />);

    expect(
      screen.getByText(/looking at data from just one month so far/),
    ).toBeInTheDocument();
  });

  it("renders Budget utilization once two months of history exist", () => {
    seedMonths([PREV, NOW]);
    render(<ReportsView />);

    expect(chartsIn("Detailed breakdowns")).toBe(1);
    // The banner is the exact inverse of the gate, so it clears at the same
    // threshold — the two can never disagree.
    expect(
      screen.queryByText(/looking at data from just one month so far/),
    ).not.toBeInTheDocument();
  });

  it("keeps the zero-filling trend charts mounted at one month", () => {
    seedMonths([NOW]);
    render(<ReportsView />);

    // These plot every month in the window (zeros where empty), so one month
    // reads correctly as "nothing yet" — they are deliberately NOT gated.
    expect(chartsIn("Savings trend")).toBe(1);
    expect(chartsIn("Spending trend")).toBe(1);
    // Cash flow is a static import, so it renders for real rather than as a
    // skeleton — assert on its card title, which is deliberately worded
    // differently from the section heading above it.
    expect(screen.getByText("Money in vs out")).toBeInTheDocument();
  });
});
