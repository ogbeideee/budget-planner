"use client";

import { useMemo } from "react";
import { BarChart } from "@/components/charts/BarChart";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";
import { spendingByCategory } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function ExpenseBreakdown({
  month,
  bare = false,
}: {
  month: Month;
  bare?: boolean;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const spends = useMemo(
    () => spendingByCategory(transactions, month),
    [transactions, month],
  );

  if (spends.length === 0) {
    return bare ? (
      <EmptyState
        title="No expenses this month"
        description="Expense categories will appear here as you spend."
      />
    ) : (
      <Card title="Expense breakdown">
        <EmptyState
          title="No expenses this month"
          description="Expense categories will appear here as you spend."
        />
      </Card>
    );
  }

  const total = spends.reduce((sum, spend) => sum + spend.amount, 0);
  const max = spends[0].amount;
  const items = spends.map((spend) => {
    const category = categories.find((c) => c.id === spend.categoryId);
    const pct = total > 0 ? Math.round((100 * spend.amount) / total) : 0;
    return {
      label: category?.name ?? "Category",
      value: spend.amount,
      max,
      color: category?.color ?? "#0ea5e9",
      valueLabel: formatMoney(spend.amount, currency),
      pct: `${pct}%`,
    };
  });
  const ariaLabel = `Expense breakdown: ${items
    .map((item) => `${item.label} ${item.valueLabel} (${item.pct})`)
    .join(", ")}`;

  if (bare) return <BarChart items={items} ariaLabel={ariaLabel} />;

  return (
    <Card title="Expense breakdown">
      <BarChart items={items} ariaLabel={ariaLabel} />
    </Card>
  );
}
