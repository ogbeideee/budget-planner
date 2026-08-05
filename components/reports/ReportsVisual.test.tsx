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
  it("renders chart cards with the calm quiet treatment", () => {
    render(
      <ChartCard title="Income vs expenses" subtitle="Last 6 months">
        body
      </ChartCard>,
    );
    const card = document.querySelector("section")!;
    expect(card.className).toContain("bg-canvas/40");
    expect(card.className).toContain("shadow-none");
    expect(screen.getByText("Last 6 months")).toBeInTheDocument();
  });

  it("renders section titles at the larger size", () => {
    render(<SectionHeading>Financial snapshot</SectionHeading>);
    expect(screen.getByText("Financial snapshot").className).toContain(
      "text-sm",
    );
  });
});

describe("Reports chart subtitles", () => {
  const specs: ChartSpec[] = [
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