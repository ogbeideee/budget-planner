"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Slider } from "@/components/ui/Slider";
import { clampAllocation, totalAllocated } from "@/lib/allocation";
import type { Allocations } from "@/lib/allocation";
import { monthFinance } from "@/lib/finance";
import { formatMoney, MINOR_UNITS_PER_UNIT } from "@/lib/money";
import { budgetProgress, effectiveLimit } from "@/lib/selectors";
import type { Budget, Category, Month } from "@/lib/types";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";

export interface AllocationTarget {
  budgetId: string;
  categoryId: string;
  categoryName: string;
}

interface Source {
  budget: Budget;
  category?: Category;
  /** Limit minus spent — what this category still has room for. */
  available: number;
}

/**
 * On-demand "add funds to a category" drawer. It replaced the always-mounted
 * "Allocate remaining" section: nothing renders until a row asks for it, and
 * every number below is read from the store at open time.
 *
 * Persistence is unchanged — moving money is still just `updateBudget` on the
 * source (limit down) and the target (limit up).
 */
export function AllocationDrawer({
  open,
  month,
  target,
  onClose,
}: {
  open: boolean;
  month: Month;
  target: AllocationTarget | null;
  onClose: () => void;
}) {
  if (!open || !target) return null;
  // Keyed on the target so every open starts from live data with empty drafts,
  // which is also what makes Cancel/Escape/scrim discard changes for free.
  return (
    <AllocationDrawerBody
      key={target.budgetId}
      month={month}
      target={target}
      onClose={onClose}
    />
  );
}

function AllocationDrawerBody({
  month,
  target,
  onClose,
}: {
  month: Month;
  target: AllocationTarget;
  onClose: () => void;
}) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const rollovers = useAppStore((s) => s.state.rollovers);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const updateBudget = useAppStore((s) => s.updateBudget);
  const { success } = useToast();

  const targetBudget = budgets.find((entry) => entry.id === target.budgetId);

  const targetLimit = targetBudget?.limit ?? 0;
  const [moves, setMoves] = useState<Allocations>({});
  const [newLimit, setNewLimit] = useState(targetLimit);

  const overage = useMemo(() => {
    if (!targetBudget) return 0;
    const progress = budgetProgress(targetBudget, transactions, rollovers);
    return Math.max(0, progress.spent - progress.limit);
  }, [targetBudget, transactions, rollovers]);

  const sources = useMemo<Source[]>(() => {
    if (!targetBudget) return [];
    return budgets
      .filter(
        (budget) => budget.month === month && budget.id !== targetBudget.id,
      )
      .map((budget) => ({
        budget,
        category: categories.find((entry) => entry.id === budget.categoryId),
        // Capped at the BASE limit: moving funds rewrites base limits, and a
        // category's carried-over funds were settled by a past month's record
        // that must not be edited. So a category may donate what it has not
        // spent, but never more base limit than it actually holds.
        available: Math.min(
          budgetProgress(budget, transactions, rollovers).remaining,
          budget.limit,
        ),
      }))
      .filter((source) => source.available > 0)
      .sort(
        (a, b) =>
          b.available - a.available ||
          (a.category?.name ?? "").localeCompare(b.category?.name ?? ""),
      );
  }, [budgets, categories, transactions, month, targetBudget, rollovers]);

  const unallocated = useMemo(() => {
    const committed = budgets
      .filter((budget) => budget.month === month)
      .reduce((sum, budget) => sum + effectiveLimit(budget, rollovers), 0);
    return Math.max(
      0,
      monthFinance(transactions, incomePlans, month).received - committed,
    );
  }, [budgets, transactions, incomePlans, month, rollovers]);

  if (!targetBudget) return null;

  const over = overage > 0;
  const fmt = (value: number) => formatMoney(value, currency);
  const moved = totalAllocated(moves);
  // When the target is over budget the moves together may only bring it back
  // to its limit — never further.
  const moveCeiling = over
    ? overage
    : sources.reduce((sum, source) => sum + source.available, 0);
  const limitMax =
    targetLimit +
    Math.max(over ? overage : unallocated, MINOR_UNITS_PER_UNIT);
  const step = MINOR_UNITS_PER_UNIT;
  const dirty = moved > 0 || newLimit !== targetLimit;

  const setMove = (source: Source, next: number) => {
    const otherTotal = moved - (moves[source.budget.id] ?? 0);
    const clamped = Math.min(
      clampAllocation(next, moveCeiling, otherTotal),
      source.available,
    );
    setMoves((prev) => ({ ...prev, [source.budget.id]: clamped }));
  };

  const apply = () => {
    for (const source of sources) {
      const amount = moves[source.budget.id] ?? 0;
      if (amount > 0) {
        updateBudget(source.budget.id, {
          limit: source.budget.limit - amount,
        });
      }
    }
    const finalLimit = newLimit + moved;
    if (finalLimit !== targetBudget.limit) {
      updateBudget(targetBudget.id, { limit: finalLimit });
    }
    success(
      moved > 0
        ? `Moved ${fmt(moved)} to ${target.categoryName}`
        : `${target.categoryName} limit set to ${fmt(finalLimit)}`,
    );
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Add funds to ${target.categoryName}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!dirty}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {over ? (
          <p className="rounded-xl border border-danger/25 bg-expense-surface px-4 py-3 text-sm font-medium leading-relaxed text-ink">
            {target.categoryName} is {fmt(overage)} over its {fmt(targetLimit)}{" "}
            limit this month. Move money from a category with room to spare, or
            raise the limit.
          </p>
        ) : (
          <p className="rounded-xl border border-border/60 bg-canvas/40 px-4 py-3 text-sm font-medium leading-relaxed text-muted">
            Choose how much to allocate to {target.categoryName} from this
            month&apos;s unallocated funds.
          </p>
        )}

        {sources.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold tracking-tight text-ink">
                Move funds from
              </h3>
              {over && (
                <span className="text-caption font-medium tabular-nums text-muted">
                  {fmt(moved)} of {fmt(overage)}
                </span>
              )}
            </div>
            {sources.map((source) => {
              const value = moves[source.budget.id] ?? 0;
              const display = categoryDisplay(source.category, "Category");
              const name = display.name;
              return (
                <div
                  key={source.budget.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-canvas/40 p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                      style={{
                        backgroundColor: `${display.color}1f`,
                        color: display.color,
                      }}
                    >
                      {display.icon}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {name}
                    </p>
                    <span className="shrink-0 text-caption font-medium tabular-nums text-muted">
                      {fmt(source.available)} available
                    </span>
                  </div>
                  <Slider
                    label={`Move from ${name}`}
                    value={value}
                    min={0}
                    max={source.available}
                    step={step}
                    onChange={(next) => setMove(source, next)}
                    displayValue={fmt(value)}
                  />
                </div>
              );
            })}
          </section>
        )}

        <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight text-ink">
              Or raise the limit
            </h3>
            <span className="text-caption font-medium tabular-nums text-muted">
              now {fmt(targetLimit)}
            </span>
          </div>
          <Slider
            label={`New limit for ${target.categoryName}`}
            value={Math.min(newLimit, limitMax)}
            min={targetLimit}
            max={limitMax}
            step={step}
            onChange={setNewLimit}
            displayValue={fmt(newLimit)}
          />
        </section>
      </div>
    </Drawer>
  );
}
