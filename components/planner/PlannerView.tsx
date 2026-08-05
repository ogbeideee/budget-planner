"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Disclosure } from "@/components/ui/Disclosure";
import { useMonth } from "@/hooks/useMonth";
import { BudgetHealthCard } from "./BudgetHealthCard";
import { BudgetList } from "./BudgetList";
import { DeferredSection } from "./DeferredSection";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { Hero } from "./Hero";
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
    <div className="flex flex-col gap-7">
      <Hero month={month} onMonthChange={setMonth} />
      <TodayRecommendations month={month} />
      <div className="flex flex-col gap-4">
        <SummaryCards month={month} />
        <OverBudgetAlert month={month} />
      </div>
      <Disclosure
        id={`month-at-a-glance:${month}`}
        title="Month at a glance"
        preview={() => <MonthlyStats month={month} bare preview />}
      >
        <MonthlyStats month={month} bare />
      </Disclosure>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Disclosure
            id={`needs-funding:${month}`}
            title="Needs funding"
            preview={(toggle) => (
              <NeedsFundingSection month={month} attentionOnly onExpand={toggle} />
            )}
          >
            <NeedsFundingSection month={month} />
          </Disclosure>
        </div>
        <BudgetHealthCard month={month} />
      </div>
      <BudgetList month={month} focusOver={focusOver} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Disclosure id={`quick-add:${month}`} title="Quick add expense">
          <QuickAddExpense month={month} />
        </Disclosure>
        <div className="lg:col-span-2">
          <Disclosure
            id={`deferred:${month}`}
            title="Deferred expenses"
            action={() => (
              <Link
                href={`/history?month=${month}`}
                className="rounded-sm text-sm font-semibold text-brand-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400"
              >
                View in Timeline
              </Link>
            )}
          >
            <DeferredSection month={month} />
          </Disclosure>
        </div>
      </div>
      <Disclosure
        id={`expense-breakdown:${month}`}
        title="Expense breakdown"
        variant="quiet"
        preview={(toggle) => (
          <ExpenseBreakdown month={month} bare limit={5} onExpand={toggle} />
        )}
      >
        <ExpenseBreakdown month={month} bare />
      </Disclosure>
    </div>
  );
}
