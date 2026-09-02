"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedMoney } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  CalendarIcon,
  CheckIcon,
  InfoIcon,
  PencilIcon,
  TargetIcon,
} from "@/components/ui/icons";
import { formatMonthLabel } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { monthPlan } from "@/lib/monthPlan";
import type { Month } from "@/lib/types";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { scrollToBudgetAllocation } from "./reviewBudgets";
import { IncomeModal } from "./IncomeModal";

/** How many funding gaps to show inline before pointing at the budget list. */
const MAX_GAPS_SHOWN = 3;

/**
 * FR-27 — Upcoming month planning (foundation).
 *
 * Rendered by the Planner ONLY while the selected month is in the future
 * (`isFutureMonth`); current and past months keep their existing surfaces
 * untouched. Every figure comes from `lib/monthPlan`, which composes the
 * existing selectors (`expectedIncomeForMonth`, `fundingNeeds`,
 * `effectiveLimit`) — nothing here calculates on its own.
 *
 * Planning actions reuse the ordinary write paths: income via the shared
 * `IncomeModal` (month-scoped `setIncomePlan`), expenses via the Upcoming
 * screen's `FutureExpenseForm`, allocations via the existing
 * `#budget-allocation` budget list.
 */
export function MonthPlanCard({ month }: { month: Month }) {
  const router = useRouter();
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [incomeOpen, setIncomeOpen] = useState(false);

  const plan = useMemo(
    () =>
      monthPlan({
        month,
        budgets,
        categories,
        futureExpenses,
        incomePlans,
      }),
    [month, budgets, categories, futureExpenses, incomePlans],
  );

  const fmt = (value: number) => formatMoney(value, currency);
  const monthLabel = formatMonthLabel(month);
  const budgetCount = budgets.filter(
    (budget) => budget.month === month && budget.limit > 0,
  ).length;
  const plannedCount = futureExpenses.filter(
    (expense) =>
      expense.status !== "paid" && expense.dueDate.startsWith(month),
  ).length;

  const coverage =
    plan.totalCommitments > 0
      ? Math.min(1, plan.expectedIncome / plan.totalCommitments)
      : 1;

  const statusBadge =
    plan.status === "funded" ? (
      <Badge variant="success">
        <CheckIcon className="h-3 w-3" /> Adequately funded
      </Badge>
    ) : plan.status === "underfunded" ? (
      <Badge variant="warning">
        <InfoIcon className="h-3 w-3" /> Underfunded
      </Badge>
    ) : (
      <Badge variant="neutral">No income planned</Badge>
    );

  return (
    <Card
      id="month-plan"
      variant="brand"
      title={`Planning ${monthLabel}`}
      subtitle="Lay the month out before it begins — expected income against everything you have planned."
      action={statusBadge}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          compact
          label="Expected income"
          value={<AnimatedMoney value={plan.expectedIncome} currency={currency} />}
          support={
            incomePlans.filter((p) => p.month === month).length === 0
              ? "None planned yet"
              : "From your income plan"
          }
          icon={<PencilIcon className="h-4 w-4" />}
          onClick={() => setIncomeOpen(true)}
          ariaLabel="Edit expected income for this month"
        />
        <MetricCard
          compact
          label="Planned expenses"
          value={<AnimatedMoney value={plan.plannedExpenses} currency={currency} />}
          support={
            plannedCount === 0
              ? "Nothing scheduled yet"
              : `${plannedCount} upcoming ${plannedCount === 1 ? "expense" : "expenses"}`
          }
          icon={<CalendarIcon className="h-4 w-4" />}
          onClick={() => router.push("/upcoming")}
          ariaLabel="Plan expenses on the Upcoming screen"
        />
        <MetricCard
          compact
          label="Budgeted"
          value={<AnimatedMoney value={plan.allocated} currency={currency} />}
          support={
            budgetCount === 0
              ? "No budgets yet"
              : `${budgetCount} ${budgetCount === 1 ? "budget" : "budgets"}`
          }
          icon={<TargetIcon className="h-4 w-4" />}
          onClick={scrollToBudgetAllocation}
          ariaLabel="Allocate budgets for this month"
        />
        <MetricCard
          compact
          label="Projected remaining"
          value={
            <span className={plan.projectedRemaining < 0 ? "text-warn" : "text-income"}>
              <AnimatedMoney value={plan.projectedRemaining} currency={currency} />
            </span>
          }
          support={
            plan.status === "no-income"
              ? "Add income to project"
              : `After ${fmt(plan.totalCommitments)} in commitments`
          }
          icon={<CheckIcon className="h-4 w-4" />}
        />
      </div>
      {plan.status !== "no-income" && (
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-caption font-medium tabular-nums text-muted">
              Income covers {Math.round(coverage * 100)}% of planned commitments
            </span>
            <span className="shrink-0 text-caption font-medium tabular-nums text-muted">
              {fmt(plan.expectedIncome)} / {fmt(plan.totalCommitments)}
            </span>
          </div>
          <ProgressBar
            value={coverage}
            thin
            tone={
              plan.status === "funded"
                ? "success"
                : plan.projectedRemaining < 0
                  ? "warn"
                  : "brand"
            }
          />
        </div>
      )}
      <div
        aria-live="polite"
        className={`mt-4 flex flex-col gap-1 rounded-xl border px-4 py-3 ${
          plan.status === "funded"
            ? "border-income/20 bg-income/[0.05]"
            : plan.status === "underfunded"
              ? "border-warn/20 bg-warn/[0.05]"
              : "border-border/60 bg-canvas/50"
        }`}
      >
        <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
          {plan.status === "funded" ? (
            <CheckIcon className="h-4 w-4 shrink-0 text-income" />
          ) : plan.status === "underfunded" ? (
            <InfoIcon className="h-4 w-4 shrink-0 text-warn" />
          ) : (
            <InfoIcon className="h-4 w-4 shrink-0 text-muted" />
          )}
          {plan.status === "funded" &&
            `Adequately funded — ${fmt(plan.projectedRemaining)} spare after every commitment.`}
          {plan.status === "underfunded" &&
            `Underfunded — expected income falls ${fmt(Math.abs(plan.projectedRemaining))} short of planned commitments.`}
          {plan.status === "no-income" &&
            "No income planned for this month yet — add expected income to see whether it is adequately funded."}
        </p>
        <p className="text-xs text-muted">
          Total planned commitments: {fmt(plan.totalCommitments)} (
          {fmt(plan.allocated)} budgeted + {fmt(plan.unmetObligations)} still
          needs funding).
        </p>
      </div>
      {plan.gaps.length > 0 && (
        <div className="mt-4">
          <p className="text-caption font-semibold text-muted">
            Still needs funding
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {plan.gaps.slice(0, MAX_GAPS_SHOWN).map((need) => {
              const display = categoryDisplay(need.category);
              return (
                <li
                  key={need.category.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${display.chip}`}
                  >
                    {display.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {display.name}
                  </span>
                  <span className="shrink-0 text-caption font-medium tabular-nums text-muted">
                    {need.budgeted
                      ? `${fmt(need.target - need.allocated)} over allocation`
                      : "Unbudgeted"}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-warn">
                    {fmt(need.missing)}
                  </span>
                </li>
              );
            })}
          </ul>
          {plan.gaps.length > MAX_GAPS_SHOWN && (
            <p className="mt-2 text-caption text-muted">
              + {plan.gaps.length - MAX_GAPS_SHOWN} more — see the budget list
              below.
            </p>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          icon={<PencilIcon className="h-4 w-4" />}
          onClick={() => setIncomeOpen(true)}
        >
          Edit income
        </Button>
        <Button
          variant="secondary"
          icon={<CalendarIcon className="h-4 w-4" />}
          onClick={() => router.push("/upcoming")}
        >
          Plan expenses
        </Button>
        <Button
          variant="secondary"
          icon={<TargetIcon className="h-4 w-4" />}
          onClick={scrollToBudgetAllocation}
        >
          Allocate budgets
        </Button>
      </div>

      <IncomeModal
        month={month}
        open={incomeOpen}
        onClose={() => setIncomeOpen(false)}
      />
    </Card>
  );
}
