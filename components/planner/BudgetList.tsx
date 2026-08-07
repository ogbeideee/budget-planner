"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatedMoney } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Disclosure } from "@/components/ui/Disclosure";
import type { DisclosureHandle } from "@/components/ui/Disclosure";
import { DonutChart } from "@/components/charts/DonutChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { categoryColor } from "@/lib/accents";
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
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

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
      if (!budgetId) return;
      // Read the freshest budgets at event time: the event is dispatched
      // synchronously after a store write (e.g. NeedsFundingSection saving a
      // budget), before this effect has re-run — a closure over `monthBudgets`
      // would still be missing the just-created budget and swallow the event.
      const budgetsNow = useAppStore.getState().state.budgets;
      if (
        !budgetsNow.some(
          (budget) => budget.month === month && budget.id === budgetId,
        )
      ) {
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
  }, [month]);

  const allocatable = useMemo(
    () => monthFinance(transactions, incomePlans, month).received,
    [transactions, incomePlans, month],
  );
  const committed = useMemo(
    () => monthBudgets.reduce((sum, budget) => sum + budget.limit, 0),
    [monthBudgets],
  );
  const remainingToAllocate = allocatable - committed;
  const fundedPct = allocatable > 0 ? committed / allocatable : 0;
  const overCommitted = committed > allocatable;
  const fundedPctText =
    allocatable > 0 ? `${Math.round(fundedPct * 100)}%` : null;
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

  const renderRows = (rows: Budget[]) => (
    <div className="flex flex-col gap-1">
      {rows.map((budget) => {
        const progress = progressById.get(budget.id);
        if (!progress) return null;
        return (
          <div
            key={budget.id}
            onMouseEnter={() => setActiveSegment(budget.id)}
            onMouseLeave={() => setActiveSegment(null)}
          >
            <BudgetRow
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
          </div>
        );
      })}
    </div>
  );

  const donutSegments = monthBudgets.map((budget) => ({
    id: budget.id,
    label: categoryOf(budget)?.name ?? "Category",
    value: budget.limit,
    color: categoryColor(categoryOf(budget)),
  }));

  return (
    <div
      ref={sectionRef}
      id="budget-allocation"
      className="flex scroll-mt-24 flex-col gap-5"
    >
      <Disclosure
        ref={disclosureRef}
        id={`budgets:${month}`}
        title="Budget Allocation"
        badge={
          monthBudgets.length > 0 ? (
            <span className="rounded-full bg-sidebar-hover px-2.5 py-0.5 text-caption font-medium text-muted">
              {monthBudgets.length}{" "}
              {monthBudgets.length === 1 ? "budget" : "budgets"}
            </span>
          ) : undefined
        }
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
          {monthBudgets.length === 0 ? (
            <EmptyState
              illustration="target"
              illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
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
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              <div className="flex flex-col items-center gap-5 lg:col-span-2">
                <DonutChart
                  segments={donutSegments}
                  centerValue={
                    <AnimatedMoney
                      value={committed}
                      currency={currency}
                      className="text-kpi-tertiary font-bold tracking-[-0.02em] text-ink"
                    />
                  }
                  centerLabel="committed"
                  activeId={activeSegment}
                  onSegmentHover={setActiveSegment}
                />
                {showFundingBar && (
                  <div className="flex w-full max-w-xs flex-col gap-1.5">
                    {overCommitted ? (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-caption font-semibold text-warn">
                          Over allocated
                        </p>
                        {fundedPctText && (
                          <span className="text-caption font-semibold tabular-nums text-warn">
                            {fundedPctText}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-caption font-medium text-muted">
                            Allocated {fmt(committed)} of {fmt(allocatable)}{" "}
                            allocatable
                          </p>
                          {fundedPctText && (
                            <span className="text-caption font-semibold tabular-nums text-muted">
                              {fundedPctText}
                            </span>
                          )}
                        </div>
                        <p className="text-caption font-medium text-muted">
                          Remaining to allocate {fmt(remainingToAllocate)}
                        </p>
                      </>
                    )}
                    <ProgressBar
                      value={Math.min(1, fundedPct)}
                      tone={overCommitted ? "warn" : "brand"}
                    />
                    {overCommitted && (
                      <p className="mt-1 text-xs text-warn">
                        Limits exceed the allocatable income — reduce a limit
                        or add income.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="lg:col-span-3">{renderRows(monthBudgets)}</div>
            </div>
          )}
        </div>
      </Disclosure>

      {pastMonths.length > 0 && (
        <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-surface p-5">
          <h2 className="text-base font-semibold tracking-tight text-ink">Past months</h2>
          <div className="flex flex-col gap-4">
            {pastMonths.map((pastMonth) => (
              <Disclosure
                key={pastMonth}
                id={`past-months:${pastMonth}`}
                title={formatMonthLabel(pastMonth)}
                variant="section"
              >
                {renderRows(
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
