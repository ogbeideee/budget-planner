"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { DonutChart } from "@/components/charts/DonutChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMonthLabel } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { budgetProgress, effectiveLimit } from "@/lib/selectors";
import type { Budget, Month } from "@/lib/types";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";
import { AllocationDrawer } from "./AllocationDrawer";
import type { AllocationTarget } from "./AllocationDrawer";
import { BudgetForm } from "./BudgetForm";
import { BudgetRow } from "./BudgetRow";
import { BudgetSuggestions } from "./BudgetSuggestions";

export interface BudgetListProps {
  month: Month;
  focusOver?: boolean;
  focusCreate?: boolean;
}

interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

/** Categories listed in the donut legend; the rest are in the list column. */
const LEGEND_LIMIT = 5;

const DONUT_RESERVE_COLORS = [
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#6366f1",
  "#0d9488",
];

export function BudgetList({
  month,
  focusOver = false,
  focusCreate = false,
}: BudgetListProps) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const rollovers = useAppStore((s) => s.state.rollovers);
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
  const [allocating, setAllocating] = useState<AllocationTarget | null>(null);

  const sectionRef = useRef<HTMLDivElement>(null);

  const categoryRank = useMemo(
    () => new Map(categories.map((category, index) => [category.id, index])),
    [categories],
  );

  const monthBudgets = useMemo(
    () =>
      budgets
        .filter((budget) => budget.month === month)
        .sort(
          (a, b) =>
            (categoryRank.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER) -
              (categoryRank.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER) ||
            a.categoryId.localeCompare(b.categoryId),
        ),
    [budgets, month, categoryRank],
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
    () =>
      new Map(
        monthBudgets.map((budget) => [
          budget.id,
          budgetProgress(budget, transactions, rollovers),
        ]),
      ),
    [monthBudgets, transactions, rollovers],
  );

  const overBudgets = useMemo(
    () => monthBudgets.filter((budget) => progressById.get(budget.id)?.over),
    [monthBudgets, progressById],
  );

  useEffect(() => {
    if (!focusOver || overBudgets.length === 0) return;
    const scrollTimer = window.setTimeout(() => {
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
    if (!focusCreate) return;
    const scrollTimer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setEditing(null);
      setFormSession((session) => session + 1);
      setFormOpen(true);
    }, 60);
    return () => window.clearTimeout(scrollTimer);
  }, [focusCreate]);

  useEffect(() => {
    const onFocusBudget = (event: Event) => {
      const budgetId = (event as CustomEvent<{ budgetId?: string }>).detail
        ?.budgetId;
      if (!budgetId) return;
      // Read the freshest budgets at event time: the event is dispatched
      // synchronously after a store write (e.g. a panel saving a new
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
      setFocusedBudgetId(budgetId);
      window.setTimeout(() => {
        document
          .getElementById(`budget-row-${budgetId}`)
          ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
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
    () =>
      monthBudgets.reduce(
        (sum, budget) => sum + effectiveLimit(budget, rollovers),
        0,
      ),
    [monthBudgets, rollovers],
  );
  const remainingToAllocate = allocatable - committed;
  const fundedPct = allocatable > 0 ? committed / allocatable : 0;
  const overCommitted = committed > allocatable;
  const fundedPctText =
    allocatable > 0 ? `${Math.round(fundedPct * 100)}%` : null;
  const allocatedPct = allocatable > 0 ? Math.round(fundedPct * 100) : 0;
  const allocatedBar = allocatable > 0 ? Math.min(1, fundedPct) : 0;
  const remainingPct = Math.max(0, 100 - allocatedPct);
  const remainingBar = Math.max(0, 1 - allocatedBar);
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
              onAllocate={() =>
                setAllocating({
                  budgetId: budget.id,
                  categoryId: budget.categoryId,
                  categoryName: categoryLabelOr(categoryOf(budget)?.name, "Category"),
                })
              }
              onDelete={() => setPendingDelete(budget)}
            />
          </div>
        );
      })}
    </div>
  );

  const donutSegments = monthBudgets
    .map((budget) => {
      const category = categoryOf(budget);
      return {
        id: budget.id,
        label: categoryDisplay(category, "Category").name,
        value: effectiveLimit(budget, rollovers),
        color: categoryDisplay(category).color,
      };
    })
    .reduce<DonutSegment[]>((segments, segment) => {
      const usedColors = new Set(segments.map((s) => s.color));
      const color = usedColors.has(segment.color)
        ? DONUT_RESERVE_COLORS.find((hue) => !usedColors.has(hue)) ?? segment.color
        : segment.color;
      return [...segments, { ...segment, color }];
    }, []);

  // Legend shows only the biggest five — the full list lives in the right-hand
  // column, so repeating every category here would be the duplication we just
  // removed. Colors come straight from the donut segments.
  const legend = [...donutSegments]
    .sort((a, b) => b.value - a.value)
    .slice(0, LEGEND_LIMIT)
    .map((segment) => ({
      ...segment,
      pct: committed > 0 ? Math.round((100 * segment.value) / committed) : 0,
    }));

  const openNewBudget = () => {
    setEditing(null);
    setFormSession((session) => session + 1);
    setFormOpen(true);
  };

  return (
    <div
      ref={sectionRef}
      id="budget-allocation"
      className="relative scroll-mt-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(60%_110%_at_92%_-8%,rgba(14,165,164,0.07),transparent_62%),radial-gradient(55%_100%_at_4%_108%,rgba(59,130,246,0.06),transparent_62%)]" />
        <svg
          className="absolute -right-6 top-2 hidden select-none md:block"
          width="320"
          height="180"
          viewBox="0 0 320 180"
          fill="none"
        >
          <circle cx="260" cy="40" r="60" stroke="rgba(14,165,164,0.1)" strokeWidth="2" />
          <circle cx="260" cy="40" r="36" stroke="rgba(14,165,164,0.12)" strokeWidth="2" />
          <circle cx="260" cy="40" r="16" stroke="rgba(14,165,164,0.14)" strokeWidth="2" />
          <path
            d="M40 150 C 100 144, 130 100, 186 96 C 236 92, 260 56, 306 48"
            stroke="rgba(14,165,164,0.22)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M40 168 C 118 162, 152 124, 220 120"
            stroke="rgba(37,99,235,0.14)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col gap-5">
      <section className="rounded-xl border border-brand-500/20 bg-surface shadow-card">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <h2 className="flex min-w-0 items-baseline gap-2 text-base font-semibold tracking-tight text-ink">
            Budgets
            <span className="shrink-0 text-sm font-medium text-muted">
              · {monthBudgets.length}{" "}
              {monthBudgets.length === 1 ? "category" : "categories"}
            </span>
          </h2>
          <Button variant="secondary" onClick={openNewBudget}>
            New budget
          </Button>
        </div>
        <div className="flex flex-col gap-4 px-6 pb-6 pt-1">
          <BudgetSuggestions
            month={month}
            onAdjust={(budget) => {
              setEditing(budget);
              setFormSession((session) => session + 1);
              setFormOpen(true);
            }}
          />
          <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
            <div className="flex w-full flex-col items-center gap-6 rounded-xl border border-border/70 bg-surface px-6 pb-5 pt-6 lg:w-[300px] lg:shrink-0">
              {monthBudgets.length === 0 ? (
                <div className="relative w-full">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                  >
                    <svg
                      className="absolute -bottom-2 right-0 hidden select-none sm:block"
                      width="180"
                      height="110"
                      viewBox="0 0 180 110"
                      fill="none"
                    >
                      <circle
                        cx="148"
                        cy="30"
                        r="18"
                        stroke="rgba(59,130,246,0.14)"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 88 C 60 82, 90 50, 138 44"
                        stroke="rgba(14,165,164,0.16)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <EmptyState
                    illustration="target"
                    illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
                    title="No budgets set up yet"
                    description="Create your first budget to begin — it's the first step to feeling in control."
                    action={
                      <Button onClick={openNewBudget}>Create a budget</Button>
                    }
                  />
                </div>
              ) : (
                <>
                  <DonutChart
                    segments={donutSegments}
                    size={180}
                    centerValue={
                      <span className="flex flex-col items-center gap-1">
                        <span className="text-[13px] font-semibold leading-tight text-muted">
                          Budgeted
                        </span>
                        <span className="text-lg font-bold leading-tight tracking-[-0.03em] text-ink">
                          {fmt(committed)}
                        </span>
                        <span className="text-xs font-medium leading-tight text-muted">
                          of {fmt(allocatable)}
                          {fundedPctText ? ` · ${fundedPctText}` : ""}
                        </span>
                      </span>
                    }
                    activeId={activeSegment}
                    onSegmentHover={setActiveSegment}
                  />
                  <ul
                    aria-label="Budget legend"
                    className="flex w-full flex-col gap-2"
                  >
                    {legend.map((entry) => (
                      <li
                        key={entry.id}
                        onMouseEnter={() => setActiveSegment(entry.id)}
                        onMouseLeave={() => setActiveSegment(null)}
                        className="flex items-center gap-2 text-caption"
                      >
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">
                          {entry.label}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-muted">
                          {entry.pct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  {showFundingBar && (
                    <div className="flex w-full flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] font-medium text-muted">
                          Allocated
                        </span>
                        <span className="text-[14px] font-semibold tabular-nums text-ink">
                          {fmt(committed)}
                        </span>
                        <span className="w-12 shrink-0 text-right text-[14px] font-bold tabular-nums text-brand-600">
                          {allocatedPct}%
                        </span>
                      </div>
                      <ProgressBar value={allocatedBar} tone="brand" thin />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] font-medium text-muted">
                          Remaining
                        </span>
                        <span className="text-[14px] font-semibold tabular-nums text-ink">
                          {fmt(Math.max(0, remainingToAllocate))}
                        </span>
                        <span className="w-12 shrink-0 text-right text-[14px] font-bold tabular-nums text-muted">
                          {remainingPct}%
                        </span>
                      </div>
                      <ProgressBar value={remainingBar} tone="brand" thin />
                      {overCommitted && (
                        <p className="text-[14px] font-medium text-warn">
                          Limits exceed the allocatable income — reduce a limit
                          or add income.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {monthBudgets.length > 0 && (
              <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-canvas/40 p-4">
                {renderRows(monthBudgets)}
              </div>
            )}
          </div>
        </div>
      </section>

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

      <AllocationDrawer
        open={allocating !== null}
        month={month}
        target={allocating}
        onClose={() => setAllocating(null)}
      />

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
    </div>
  );
}
