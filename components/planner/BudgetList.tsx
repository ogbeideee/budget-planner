"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMonthLabel } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { budgetProgress, totals } from "@/lib/selectors";
import type { Budget, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";
import { AllocationPanel } from "./AllocationPanel";
import { BudgetForm } from "./BudgetForm";
import { BudgetRow } from "./BudgetRow";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export interface BudgetListProps {
  month: Month;
}

export function BudgetList({ month }: BudgetListProps) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const deleteBudget = useAppStore((s) => s.deleteBudget);
  const { success } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Budget | null>(null);

  const monthBudgets = useMemo(
    () =>
      budgets
        .filter((budget) => budget.month === month)
        .sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            a.categoryId.localeCompare(b.categoryId),
        ),
    [budgets, month],
  );

  const pastBudgets = useMemo(
    () =>
      budgets
        .filter((budget) => budget.month !== month)
        .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)),
    [budgets, month],
  );

  const pastMonths = useMemo(
    () => [...new Set(pastBudgets.map((budget) => budget.month))],
    [pastBudgets],
  );

  const allocatable = useMemo(
    () => Math.max(0, totals(transactions, month).net),
    [transactions, month],
  );
  const committed = useMemo(
    () => monthBudgets.reduce((sum, budget) => sum + budget.limit, 0),
    [monthBudgets],
  );
  const fundedPct =
    allocatable > 0
      ? committed / allocatable
      : committed > 0
        ? 1
        : 0;
  const overCommitted = allocatable > 0 && committed > allocatable;
  const fmt = (value: number) => formatMoney(value, currency);
  const showFundingBar = committed > 0 || allocatable > 0;

  const categoryOf = (budget: Budget) =>
    categories.find((category) => category.id === budget.categoryId);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteBudget(pendingDelete.id);
    success("Budget deleted.");
    setPendingDelete(null);
  };

  const renderTable = (rows: Budget[]) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-3 py-2 font-semibold">
              Category
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Priority
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Limit
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Spent
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Remaining
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Progress
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((budget) => (
            <BudgetRow
              key={budget.id}
              budget={budget}
              category={categoryOf(budget)}
              progress={budgetProgress(budget, transactions)}
              currency={currency}
              onEdit={() => {
                setEditing(budget);
                setFormSession((session) => session + 1);
                setFormOpen(true);
              }}
              onDelete={() => setPendingDelete(budget)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={`Allocated · ${formatMonthLabel(month)}`}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormSession((session) => session + 1);
              setFormOpen(true);
            }}
          >
            New budget
          </Button>
        }
      >
        {showFundingBar && (
          <div className="flex flex-col gap-1.5 border-b border-border pb-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Committed{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {fmt(committed)}
                </span>{" "}
                of{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {fmt(allocatable)}
                </span>{" "}
                allocatable
              </p>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  overCommitted ? "text-warn" : "text-muted"
                }`}
              >
                {Math.round(Math.min(1, fundedPct) * 100)}%
              </span>
            </div>
            <ProgressBar
              value={Math.min(1, fundedPct)}
              tone={overCommitted ? "warn" : "brand"}
            />
            {overCommitted && (
              <p className="text-xs text-warn">
                Limits exceed the allocatable balance — reduce a limit or add income.
              </p>
            )}
          </div>
        )}
        {monthBudgets.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No budgets this month. Create your first budget to start tracking
            spending.
          </p>
        ) : (
          renderTable(monthBudgets)
        )}
      </Card>

      {pastMonths.length > 0 && (
        <Card title="Past months">
          <div className="flex flex-col gap-4">
            {pastMonths.map((pastMonth) => (
              <details key={pastMonth}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">
                  {formatMonthLabel(pastMonth)}
                </summary>
                <div className="mt-2">
                  {renderTable(
                    pastBudgets.filter((budget) => budget.month === pastMonth),
                  )}
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}

      <AllocationPanel month={month} />

      <BudgetForm
        key={formSession}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        month={month}
        budget={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete budget"
        message={
          pendingDelete
            ? `Delete the budget for ${categoryOf(pendingDelete)?.name ?? "this category"} in ${formatMonthLabel(pendingDelete.month)}?`
            : ""
        }
        confirmLabel="Delete budget"
        danger
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
