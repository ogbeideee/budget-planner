"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { clampAllocation, totalAllocated } from "@/lib/allocation";
import type { Allocations } from "@/lib/allocation";
import { formatMoney } from "@/lib/money";
import { totals } from "@/lib/selectors";
import type { Budget, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";

export function AllocationPanel({
  month,
  bare = false,
}: {
  month: Month;
  bare?: boolean;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);

  const monthBudgets = useMemo(
    () => budgets.filter((budget) => budget.month === month),
    [budgets, month],
  );
  const remaining = Math.max(0, totals(transactions, month).net);

  if (monthBudgets.length === 0) return null;

  if (remaining <= 0) {
    const message = (
      <p className="text-sm text-muted">
        Nothing left to allocate — expenses equal or exceed income this month.
      </p>
    );
    if (bare) return message;
    return <Card title="Allocate remaining">{message}</Card>;
  }

  return (
    <AllocationControls
      key={month}
      monthBudgets={monthBudgets}
      remaining={remaining}
      bare={bare}
    />
  );
}

interface AllocationControlsProps {
  monthBudgets: Budget[];
  remaining: number;
  bare?: boolean;
}

function AllocationControls({
  monthBudgets,
  remaining,
  bare = false,
}: AllocationControlsProps) {
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const updateBudget = useAppStore((s) => s.updateBudget);
  const { success } = useToast();

  const [allocations, setAllocations] = useState<Allocations>({});

  const allocated = totalAllocated(allocations);
  const unallocated = remaining - allocated;
  const fmt = (value: number) => formatMoney(value, currency);

  const handleChange = (budgetId: string, next: number) => {
    const otherTotal = totalAllocated(allocations) - (allocations[budgetId] ?? 0);
    const clamped = clampAllocation(next, remaining, otherTotal);
    setAllocations((prev) => ({ ...prev, [budgetId]: clamped }));
  };

  const apply = () => {
    const entries = Object.entries(allocations).filter(([, value]) => value > 0);
    if (entries.length === 0) return;
    const amounts = new Map(entries);
    for (const budget of monthBudgets) {
      const amount = amounts.get(budget.id);
      if (amount !== undefined) {
        updateBudget(budget.id, { limit: budget.limit + amount });
      }
    }
    success(
      `Allocated ${fmt(allocated)} across ${entries.length} budget${entries.length === 1 ? "" : "s"}`,
    );
    setAllocations({});
  };

  const content = (
    <div className="flex flex-col gap-5">
      {monthBudgets.map((budget) => {
        const category = categories.find((c) => c.id === budget.categoryId);
        const value = allocations[budget.id] ?? 0;
        const pct = remaining > 0 ? Math.round((100 * value) / remaining) : 0;
        return (
          <div key={budget.id} className="flex flex-col gap-1.5">
            <Slider
              label={`${category?.icon ?? ""} ${category?.name ?? "Category"}`}
              value={value}
              min={0}
              max={remaining}
              step={100}
              onChange={(next) => handleChange(budget.id, next)}
              displayValue={fmt(value)}
            />
            <p className="text-xs text-muted">
              {pct}% of remaining · current limit {fmt(budget.limit)}
            </p>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm font-semibold tabular-nums">
          Unallocated: {fmt(unallocated)}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setAllocations({})}
            disabled={allocated === 0}
          >
            Reset
          </Button>
          <Button onClick={apply} disabled={allocated === 0}>
            Apply allocations
          </Button>
        </div>
      </div>
    </div>
  );

  if (bare) return content;

  return (
    <Card
      title="Allocate remaining"
      action={
        <span className="text-sm font-semibold tabular-nums text-muted">
          {fmt(remaining)} left
        </span>
      }
    >
      {content}
    </Card>
  );
}
