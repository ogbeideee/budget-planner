"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { AnimatedMoney } from "@/components/ui/AnimatedNumber";
import { clampAllocation, totalAllocated } from "@/lib/allocation";
import type { Allocations } from "@/lib/allocation";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { spent } from "@/lib/selectors";
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
  const incomePlans = useAppStore((s) => s.state.incomePlans);

  const monthBudgets = useMemo(
    () => budgets.filter((budget) => budget.month === month),
    [budgets, month],
  );
  const remaining = useMemo(
    () => monthFinance(transactions, incomePlans, month).remaining,
    [transactions, incomePlans, month],
  );

  if (monthBudgets.length === 0) return null;

  if (remaining <= 0) {
    const message = (
      <p className="text-sm text-muted">
        Nothing left to allocate — your received income for this month is
        already accounted for.
      </p>
    );
    if (bare) return message;
    return <Card title="Allocate remaining">{message}</Card>;
  }

  return (
    <AllocationControls
      key={month}
      month={month}
      monthBudgets={monthBudgets}
      remaining={remaining}
      bare={bare}
    />
  );
}

interface AllocationControlsProps {
  month: Month;
  monthBudgets: Budget[];
  remaining: number;
  bare?: boolean;
}

function AllocationControls({
  month,
  monthBudgets,
  remaining,
  bare = false,
}: AllocationControlsProps) {
  const categories = useAppStore((s) => s.state.categories);
  const transactions = useAppStore((s) => s.state.transactions);
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
    <div className="flex flex-col gap-3">
      {monthBudgets.map((budget) => {
        const category = categories.find((c) => c.id === budget.categoryId);
        const value = allocations[budget.id] ?? 0;
        const spentSoFar = spent(transactions, budget.categoryId, month);
        const left = Math.max(0, budget.limit - spentSoFar);
        const projected = budget.limit + value;
        const pct = remaining > 0 ? Math.round((100 * value) / remaining) : 0;
        return (
          <div
            key={budget.id}
            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-canvas/40 p-4"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base transition-transform duration-150 ease-premium"
                style={{
                  backgroundColor: `${category?.color ?? "#6b7280"}1f`,
                  color: category?.color ?? "#6b7280",
                }}
              >
                {category?.icon ?? ""}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold tracking-tight text-ink">
                  {category?.name ?? "Category"}
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-muted">
                  Allocated {fmt(budget.limit)} · Spent {fmt(spentSoFar)} · Left{" "}
                  <span className={budget.limit - spentSoFar < 0 ? "font-semibold text-expense" : ""}>
                    {fmt(left)}
                  </span>
                </p>
              </div>
              <span
                aria-hidden="true"
                className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted"
              >
                {pct}% of pool
              </span>
            </div>

            <div
              id={`allocation-slider-${budget.id}`}
              className="scroll-mt-28 flex flex-col gap-2"
            >
              <Slider
                label="Allocate"
                value={value}
                min={0}
                max={remaining}
                step={100}
                onChange={(next) => handleChange(budget.id, next)}
                displayValue={fmt(value)}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                Projected limit
                <AnimatedMoney
                  value={projected}
                  currency={currency}
                  className="text-sm font-bold tabular-nums text-ink"
                />
              </p>
              {value > 0 && (
                <button
                  type="button"
                  onClick={() => handleChange(budget.id, 0)}
                  className="text-xs font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-semibold tabular-nums text-ink">
            {fmt(unallocated)}
          </span>{" "}
          {unallocated === remaining ? "left to allocate" : "unallocated"}
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
