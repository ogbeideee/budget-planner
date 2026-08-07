import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ChartCard } from "./ChartCard";
import { ExpectedVsActualChart } from "./ExpectedVsActualChart";
import { IncomeSourceChart } from "./IncomeSourceChart";
import { IncomeTrendChart } from "./IncomeTrendChart";
import { IncomeExpenseChart } from "./IncomeExpenseChart";
import { SpendingTrendChart } from "./SpendingTrendChart";
import { SavingsChart } from "./SavingsChart";
import { BudgetUtilizationChart } from "./BudgetUtilizationChart";
import { TopCategoriesChart } from "./TopCategoriesChart";
import type { Month } from "@/lib/types";

const MONTHS: Month[] = [
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
];

interface ChartProps {
  month?: Month;
  months?: Month[];
}

interface ChartSpec {
  Chart: (props: ChartProps) => ReactElement;
  title: string;
  subtitle: string;
  props: ChartProps;
}

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

describe("Reports chrome", () => {
  it("renders chart cards as white containers with a soft shadow", () => {
    render(
      <ChartCard title="Income vs expenses" subtitle="Last 6 months">
        body
      </ChartCard>,
    );
    const card = document.querySelector("section")!;
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("shadow-card");
    expect(screen.getByText("Last 6 months")).toBeInTheDocument();
  });

  it("renders section titles in the bold section style", () => {
    render(<SectionHeading>Financial snapshot</SectionHeading>);
    expect(screen.getByText("Financial snapshot").className).toContain(
      "text-section-title",
    );
  });
});

describe("Reports chart subtitles", () => {  const specs: ChartSpec[] = [
    {
      Chart: IncomeExpenseChart as unknown as ChartSpec["Chart"],
      title: "Income vs expenses",
      subtitle: "Last 6 months",
      props: { months: MONTHS },
    },
    {
      Chart: IncomeTrendChart as unknown as ChartSpec["Chart"],
      title: "Income trend",
      subtitle: "Last 6 months",
      props: { months: MONTHS },
    },
    {
      Chart: SpendingTrendChart as unknown as ChartSpec["Chart"],
      title: "Monthly spending trend",
      subtitle: "Last 6 months",
      props: { months: MONTHS },
    },
    {
      Chart: SavingsChart as unknown as ChartSpec["Chart"],
      title: "Savings over time",
      subtitle: "Last 6 months",
      props: { months: MONTHS },
    },
    {
      Chart: BudgetUtilizationChart as unknown as ChartSpec["Chart"],
      title: "Budget utilization",
      subtitle: "Last 6 months",
      props: { months: MONTHS },
    },
    {
      Chart: TopCategoriesChart as unknown as ChartSpec["Chart"],
      title: "Top categories",
      subtitle: "Last 6 months",
      props: { months: MONTHS },
    },
    {
      Chart: ExpectedVsActualChart as unknown as ChartSpec["Chart"],
      title: "Expected vs actual",
      subtitle: "This month",
      props: { month: "2026-08" },
    },
    {
      Chart: IncomeSourceChart as unknown as ChartSpec["Chart"],
      title: "Income sources",
      subtitle: "This month",
      props: { month: "2026-08" },
    },
  ];

  it.each(specs)("$title carries a concise subtitle", ({ Chart, title, subtitle, props }) => {
    const { container } = render(<Chart {...props} />);
    expect(container.querySelector("section")).not.toBeNull();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(subtitle)).toBeInTheDocument();
  });
});

describe("Budget utilization data fidelity", () => {
  it("reports over-100 percent utilization in the accessible label", () => {
    const state = useAppStore.getState().state;
    const rentId = state.categories.find((c) => c.name === "Rent")!.id;
    useAppStore.setState({
      state: {
        ...state,
        budgets: [
          {
            id: "b1",
            categoryId: rentId,
            month: "2026-08",
            limit: 100000,
            priority: "high",
          },
        ],
        transactions: [
          {
            id: "t1",
            categoryId: rentId,
            amount: 150000,
            type: "expense",
            date: "2026-08-03",
            createdAt: "2026-08-03T00:00:00.000Z",
          },
        ],
      },
    });
    render(<BudgetUtilizationChart months={MONTHS} />);
    const image = screen.getByRole("img", {
      name: /Budget utilization:/,
    });
    expect(image.getAttribute("aria-label")).toContain("150%");
    expect(image.getAttribute("aria-label")).toContain("$1,500.00");
  });

  it("renders its empty state when the window has no budgets", () => {
    render(<BudgetUtilizationChart months={MONTHS} />);
    expect(screen.getByText("No budgets in this window")).toBeInTheDocument();
  });
});