"use client";

import { PageHeader } from "@/components/shell/PageHeader";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useMonth } from "@/hooks/useMonth";
import { usePlannerStatus } from "@/hooks/usePlannerStatus";
import { BudgetHealthCard } from "./BudgetHealthCard";
import { BudgetList } from "./BudgetList";
import { DeferredSection } from "./DeferredSection";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { InsightsPanel } from "./InsightsPanel";
import { NeedsFundingSection } from "./NeedsFundingSection";
import { OverBudgetAlert } from "./OverBudgetAlert";
import { QuickAddExpense } from "./QuickAddExpense";
import { SummaryCards } from "./SummaryCards";

export function PlannerView() {
  const { month, setMonth } = useMonth();
  const status = usePlannerStatus(month);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Budget Planner" description={status} />
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <SummaryCards month={month} />
      <OverBudgetAlert month={month} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NeedsFundingSection month={month} />
        </div>
        <BudgetHealthCard month={month} />
      </div>
      <BudgetList month={month} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickAddExpense month={month} />
        <DeferredSection month={month} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsPanel month={month} />
        <ExpenseBreakdown month={month} />
      </div>
    </div>
  );
}
