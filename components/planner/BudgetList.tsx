"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Disclosure } from "@/components/ui/Disclosure";
import type { DisclosureHandle } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMonthLabel } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { budgetProgress } from "@/lib/selectors";
import type { Budget, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";
import { AllocationPanel } from "./AllocationPanel";
import { BudgetForm } from "./BudgetForm";
import { BudgetRow } from "./BudgetRow";
import { BudgetSuggestions } from "./BudgetSuggestions";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export interface BudgetListProps {
  month: Month;
  focusOver?: boolean;
}

export function BudgetList({ month, focusOver = false }: BudgetListProps) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const deleteBudget = useAppStore((s) => s.deleteBudget);
  const { success } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Budget | null>(null);
  const [reviewActive, setReviewActive] = useState(false);
  const [focusedBudgetId, setFocusedBudgetId] = useState<string | null>(null);

  const sectionRef = useRef<HTMLDivElement>(null);
  const disclosureRef = useRef<DisclosureHandle>(null);

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

  const progressById = useMemo(
    () => new Map(monthBudgets.map((budget) => [budget.id, budgetProgress(budget, transactions)])),
    [monthBudgets, transactions],
  );

  const overBudgets = useMemo(
    () => monthBudgets.filter((budget) => progressById.get(budget.id)?.over),
    [monthBudgets, progressById],
  );

  useEffect(() => {
    if (!focusOver || overBudgets.length === 0) return;
    const scrollTimer = window.setTimeout(() => {
      disclosureRef.current?.expand();
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setReviewActive(true);
      document
        .getElementById(`budget-row-${overBudgets[0].id}`)
        ?.focus({ preventScroll: true });
    }, 60);
    const clearTimer = window.setTimeout(() => setReviewActive(false), 5000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusOver, overBudgets]);

  useEffect(() => {
    const onFocusBudget = (event: Event) => {
      const budgetId = (event as CustomEvent<{ budgetId?: string }>).detail
        ?.budgetId;
      if (!budgetId || !monthBudgets.some((budget) => budget.id === budgetId)) {
        return;
      }
      disclosureRef.current?.expand();
      setFocusedBudgetId(budgetId);
      window.setTimeout(() => {
        document
          .getElementById(`budget-row-${budgetId}`)
          ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        const slider = document.getElementById(
          `allocation-slider-${budgetId}`,
        );
        slider?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        slider
          ?.querySelector<HTMLInputElement>('input[type="range"]')
          ?.focus({ preventScroll: true });
      }, 60);
      window.setTimeout(() => setFocusedBudgetId(null), 4000);
    };
    window.addEventListener("planner:focus-budget", onFocusBudget);
    return () =>
      window.removeEventListener("planner:focus-budget", onFocusBudget);
  }, [monthBudgets]);

  const allocatable = useMemo(
    () => monthFinance(transactions, incomePlans, month).remaining,
    [transactions, incomePlans, month],
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
          <tr className="text-xs uppercase tracking-wide text-muted">
            <th
              scope="col"
              className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 font-semibold lg:top-0"
            >
              Category
            </th>
            <th
              scope="col"
              className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 font-semibold lg:top-0"
            >
              Priority
            </th>
            <th
              scope="col"
              className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 text-right font-semibold lg:top-0"
            >
              Limit
            </th>
            <th
              scope="col"
              className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 text-right font-semibold lg:top-0"
            >
              Spent
            </th>
            <th
              scope="col"
              className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 text-right font-semibold lg:top-0"
            >
              Remaining
            </th>
            <th
              scope="col"
              className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 text-right font-semibold lg:top-0"
            >
              Progress
            </th>
            <th
              scope="col"
              className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 text-right font-semibold lg:top-0"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((budget) => {
            const progress = progressById.get(budget.id);
            if (!progress) return null;
            return (
              <BudgetRow
                key={budget.id}
                budget={budget}
                category={categoryOf(budget)}
                progress={progress}
                currency={currency}
                highlighted={
                  (reviewActive && progress.over) ||
                  focusedBudgetId === budget.id
                }
                rowId={`budget-row-${budget.id}`}
                onEdit={() => {
                  setEditing(budget);
                  setFormSession((session) => session + 1);
                  setFormOpen(true);
                }}
                onDelete={() => setPendingDelete(budget)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div ref={sectionRef} className="flex scroll-mt-24 flex-col gap-5">
      <Disclosure
        ref={disclosureRef}
        id={`budgets:${month}`}
        title={`Allocated · ${formatMonthLabel(month)}`}
        variant="brand"
        action={() => (
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setFormSession((session) => session + 1);
              setFormOpen(true);
            }}
          >
            New budget
          </Button>
        )}
      >
        <div className="flex flex-col gap-6">
          <BudgetSuggestions
            month={month}
            onAdjust={(budget) => {
              setEditing(budget);
              setFormSession((session) => session + 1);
              setFormOpen(true);
            }}
          />
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
            <EmptyState
              illustration="target"
              illustrationClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
              title="Nothing planned yet"
              description="Create your first budget to begin — it's the first step to feeling in control."
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormSession((session) => session + 1);
                    setFormOpen(true);
                  }}
                >
                  Create a budget
                </Button>
              }
            />
          ) : (
            renderTable(monthBudgets)
          )}
        </div>
      </Disclosure>

      {pastMonths.length > 0 && (
        <div className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-card">
          <h2 className="text-base font-semibold tracking-tight">Past months</h2>
          <div className="flex flex-col gap-4">
            {pastMonths.map((pastMonth) => (
              <Disclosure
                key={pastMonth}
                id={`past-months:${pastMonth}`}
                title={formatMonthLabel(pastMonth)}
                variant="section"
              >
                {renderTable(
                  pastBudgets.filter((budget) => budget.month === pastMonth),
                )}
              </Disclosure>
            ))}
          </div>
        </div>
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
