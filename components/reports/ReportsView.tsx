"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useMonth } from "@/hooks/useMonth";
import { formatMonthLabel } from "@/lib/date";
import { windowMonths } from "@/lib/selectors";
import { BudgetUtilizationChart } from "./BudgetUtilizationChart";
import { IncomeExpenseChart } from "./IncomeExpenseChart";
import { SavingsChart } from "./SavingsChart";
import { SnapshotCards } from "./SnapshotCards";
import { SpendingTrendChart } from "./SpendingTrendChart";
import { TopCategoriesChart } from "./TopCategoriesChart";

export function ReportsView() {
  const { month, setMonth } = useMonth();
  const months = useMemo(() => windowMonths(month), [month]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Reports"
          description={`6-month analysis ending ${formatMonthLabel(month)}.`}
        />
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <SnapshotCards month={month} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IncomeExpenseChart months={months} />
        <SpendingTrendChart months={months} />
        <SavingsChart months={months} />
        <BudgetUtilizationChart months={months} />
      </div>
      <TopCategoriesChart months={months} />
    </div>
  );
}
