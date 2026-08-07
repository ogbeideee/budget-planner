"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { TransactionForm } from "@/components/txn/TransactionForm";
import { useMonth } from "@/hooks/useMonth";
import type { CategoryKind } from "@/lib/types";
import { BudgetHealthCard } from "./BudgetHealthCard";
import { BudgetList } from "./BudgetList";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { Hero } from "./Hero";
import { MonthlyStats } from "./MonthlyStats";
import { NeedsFundingSection } from "./NeedsFundingSection";
import { RecentActivity } from "./RecentActivity";
import { SummaryCards } from "./SummaryCards";
import { TodayRecommendations } from "./TodayRecommendations";

export function PlannerView() {
  const { month, setMonth } = useMonth();
  const searchParams = useSearchParams();
  const focusOver = searchParams.get("focus") === "over";
  const [txnType, setTxnType] = useState<CategoryKind | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Planner"
        description="Everything you need to stay on top of your finances this month."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => setTxnType("expense")}
            >
              Add Expense
            </Button>
            <Button
              variant="secondary"
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => setTxnType("income")}
            >
              Add Income
            </Button>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />
      <Hero month={month} />
      <TodayRecommendations month={month} />
      <SummaryCards month={month} />
      <MonthlyStats month={month} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Needs Funding"
          subtitle="Categories requiring attention."
        >
          <NeedsFundingSection month={month} />
        </Card>
        <div className="lg:col-span-2">
          <BudgetHealthCard month={month} />
        </div>
      </div>
      <BudgetList month={month} focusOver={focusOver} />
      <ExpenseBreakdown month={month} />
      <RecentActivity month={month} />
      <TransactionForm
        key={txnType ?? "closed"}
        open={txnType !== null}
        initialType={txnType ?? "expense"}
        onClose={() => setTxnType(null)}
      />
    </div>
  );
}
