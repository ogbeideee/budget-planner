"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart } from "@/components/charts/BarChart";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { categoryColor } from "@/lib/accents";
import { formatMoney } from "@/lib/money";
import { spendingByCategory } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const MAX_SHOWN = 5;

function label(count: number): string {
  return `Show ${count} more categor${count === 1 ? "y" : "ies"}`;
}

export function ExpenseBreakdown({
  month,
  bare = false,
  limit,
  onExpand,
}: {
  month: Month;
  bare?: boolean;
  limit?: number;
  onExpand?: () => void;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const budgets = useAppStore((s) => s.state.budgets);
  const currency = useAppStore((s) => s.state.settings.currency);
  const [expanded, setExpanded] = useState(false);

  const spends = useMemo(
    () => spendingByCategory(transactions, month),
    [transactions, month],
  );

  if (spends.length === 0) {
    const empty = (
      <EmptyState
        illustration="chart"
        illustrationClass="bg-expense/10 text-expense"
        title="Nothing recorded yet"
        description="Add your first expense and your category breakdown will take shape."
        tip="Every expense you log is grouped by category here, biggest first."
      />
    );
    return bare ? (
      empty
    ) : (
      <Card title="Expense breakdown">
        {empty}
      </Card>
    );
  }

  const total = spends.reduce((sum, spend) => sum + spend.amount, 0);
  const max = spends[0]?.amount ?? 0;

  const limited = limit !== undefined;
  const count = limited
    ? Math.min(limit, spends.length)
    : expanded
      ? spends.length
      : Math.min(MAX_SHOWN, spends.length);
  const hidden = spends.length - count;
  const visible = spends.slice(0, count);

  const items = visible.map((spend) => {
    const category = categories.find((c) => c.id === spend.categoryId);
    const budget = budgets.find(
      (b) => b.month === month && b.categoryId === spend.categoryId,
    );
    const pct = total > 0 ? Math.round((100 * spend.amount) / total) : 0;
    const spentLabel = formatMoney(spend.amount, currency);
    return {
      label: category?.name ?? "Category",
      value: spend.amount,
      max,
      color: categoryColor(category),
      valueLabel: spentLabel,
      pct: `${pct}%`,
      budget: budget ? formatMoney(budget.limit, currency) : null,
      spent: budget
        ? `${spentLabel} of ${formatMoney(budget.limit, currency)}`
        : spentLabel,
      overBudget: budget !== undefined && spend.amount > budget.limit,
    };
  });
  const ariaLabel = `Expense breakdown: ${items
    .map((item) => `${item.label} ${item.valueLabel} (${item.pct})`)
    .join(", ")}`;

  const chart = (
    <BarChart
      items={items}
      ariaLabel={ariaLabel}
      animateFrom={!limited && spends.length > MAX_SHOWN ? MAX_SHOWN : undefined}
    />
  );

  let footer: ReactNode | null = null;
  if (limited) {
    footer = (
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        {hidden > 0 ? (
          onExpand ? (
            <Button variant="ghost" size="sm" onClick={onExpand}>
              {label(hidden)}
            </Button>
          ) : (
            <p className="text-sm text-muted">
              {hidden} more categor{hidden === 1 ? "y" : "ies"} not shown
            </p>
          )
        ) : (
          <p className="text-sm text-muted">All categories shown</p>
        )}
        <p className="text-sm font-semibold tabular-nums text-ink">
          Total {formatMoney(total, currency)}
        </p>
      </div>
    );
  } else if (spends.length > MAX_SHOWN) {
    footer = (
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        {hidden > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
            {label(hidden)}
          </Button>
        ) : (
          <p className="text-sm text-muted">All categories shown</p>
        )}
        <p className="text-sm font-semibold tabular-nums text-ink">
          Total {formatMoney(total, currency)}
        </p>
      </div>
    );
  }

  const content = (
    <>
      {chart}
      {footer}
    </>
  );

  return bare ? content : <Card title="Expense breakdown">{content}</Card>;
}