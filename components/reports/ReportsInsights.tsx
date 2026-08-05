"use client";

import { InsightList } from "@/components/insights/InsightList";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function ReportsInsights({ month }: { month: Month }) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  return (
    <Card variant="quiet">
      <SectionHeading>Things to know</SectionHeading>
      <InsightList
        month={month}
        input={{
          month,
          budgets,
          transactions,
          categories,
          futureExpenses,
          incomePlans,
          currency,
        }}
      />
    </Card>
  );
}
