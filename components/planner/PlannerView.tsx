"use client";

import { useSearchParams } from "next/navigation";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useMonth } from "@/hooks/useMonth";
import { BudgetHealthCard } from "./BudgetHealthCard";
import { BudgetList } from "./BudgetList";
import { DeferredSection } from "./DeferredSection";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { Hero } from "./Hero";
import { InsightsPanel } from "./InsightsPanel";
import { MonthlyStats } from "./MonthlyStats";
import { NeedsFundingSection } from "./NeedsFundingSection";
import { OverBudgetAlert } from "./OverBudgetAlert";
import { QuickAddExpense } from "./QuickAddExpense";
import { SummaryCards } from "./SummaryCards";
import { TodayRecommendations } from "./TodayRecommendations";

export function PlannerView() {
  const { month, setMonth } = useMonth();
  const searchParams = useSearchParams();
  const focusOver = searchParams.get("focus") === "over";
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Hero month={month} />
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <TodayRecommendations month={month} />
      <div className="flex flex-col gap-4">
        <SummaryCards month={month} />
        <OverBudgetAlert month={month} />
      </div>
      <MonthlyStats month={month} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NeedsFundingSection month={month} />
        </div>
        <BudgetHealthCard month={month} />
      </div>
      <BudgetList month={month} focusOver={focusOver} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <QuickAddExpense month={month} />
        <div className="lg:col-span-2">
          <DeferredSection month={month} />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <InsightsPanel month={month} />
        </div>
        <div className="lg:col-span-3">
          <ExpenseBreakdown month={month} />
        </div>
      </div>
    </div>
  );
}
