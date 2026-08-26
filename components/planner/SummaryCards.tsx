"use client";

import { useMemo, useState } from "react";
import {
  AnimatedMoney,
  AnimatedNumber,
} from "@/components/ui/AnimatedNumber";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { MetricCard } from "@/components/ui/MetricCard";
import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  InfoIcon,
  PencilIcon,
  TargetIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { formatMonthLabel } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { monthStats } from "@/lib/monthStats";
import type { Month } from "@/lib/types";
import { budgetProgress, effectiveLimit } from "@/lib/selectors";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { AllocationDrawer } from "./AllocationDrawer";
import type { AllocationTarget } from "./AllocationDrawer";
import { IncomeModal } from "./IncomeModal";

function Comparison({
  direction,
  value,
  suffix,
  tone,
}: {
  direction: "up" | "down";
  value: string;
  suffix: string;
  tone: "good" | "bad";
}) {
  const color = tone === "good" ? "text-income" : "text-expense";
  return (
    <>
      {direction === "up" ? (
        <ArrowUpRightIcon className={`h-3.5 w-3.5 ${color}`} />
      ) : (
        <ArrowDownRightIcon className={`h-3.5 w-3.5 ${color}`} />
      )}
      <span className={`text-caption font-semibold tabular-nums ${color}`}>
        {value}
      </span>
      <span className="text-caption font-medium text-muted">{suffix}</span>
    </>
  );
}

export function SummaryCards({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const rollovers = useAppStore((s) => s.state.rollovers);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [netModalOpen, setNetModalOpen] = useState(false);
  const [remainingModalOpen, setRemainingModalOpen] = useState(false);
  const [allocating, setAllocating] = useState<AllocationTarget | null>(null);

  const { received, expected, expenses, net, remaining } = useMemo(
    () => monthFinance(transactions, incomePlans, month),
    [transactions, incomePlans, month],
  );
  const difference = expected - received;
  const savingsRate = useMemo(
    () =>
      monthStats({
        month,
        transactions,
        budgets,
        categories,
        futureExpenses,
        incomePlans,
      }).savingsRate,
    [month, transactions, budgets, categories, futureExpenses, incomePlans],
  );

  const monthBudgets = useMemo(
    () => budgets.filter((budget) => budget.month === month),
    [budgets, month],
  );
  const hasBudgets = monthBudgets.length > 0;
  const committed = useMemo(
    () =>
      monthBudgets.reduce(
        (sum, budget) => sum + effectiveLimit(budget, rollovers),
        0,
      ),
    [monthBudgets, rollovers],
  );
  const fundedPct = received > 0 ? committed / received : 0;
  const overCommitted = committed > received;

  const fmt = (value: number) => formatMoney(value, currency);

  // The month's budgets as pickable targets for the "Allocate remaining"
  // entry point — the drawer itself is per-category, so this chooses one.
  const allocationTargets = useMemo(
    () =>
      monthBudgets
        .map((budget) => {
          const progress = budgetProgress(budget, transactions, rollovers);
          return {
            budget,
            category: categories.find((entry) => entry.id === budget.categoryId),
            over: Math.max(0, progress.spent - progress.limit),
            available: Math.max(0, progress.remaining),
          };
        })
        .sort(
          (a, b) =>
            b.over - a.over ||
            (a.category?.name ?? "").localeCompare(b.category?.name ?? ""),
        ),
    [monthBudgets, categories, transactions, rollovers],
  );

  const reviewBudgets = () => {
    document
      .getElementById("budget-allocation")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        aria-live="polite"
      >
        <MetricCard
          compact
          ariaLabel={expected > 0 ? "Expected income" : "Set expected income"}
          label="Expected Income"
          value={
            <AnimatedMoney
              value={expected}
              currency={currency}
              className={expected > 0 ? "text-income" : "text-muted"}
            />
          }
          support={
            expected > 0
              ? received >= expected
                ? "All expected received"
                : `${Math.round((received / expected) * 100)}% received`
              : received > 0
                ? `Received ${fmt(received)} this month`
                : "Set what you expect to earn this month"
          }
          icon={<ArrowDownLeftIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-success-surface text-income"
          chip={
            expected > 0 ? (
              <span className="flex items-center gap-1 text-caption font-semibold text-muted transition-colors duration-default ease-premium group-hover:text-brand-600">
                <PencilIcon className="h-3 w-3" />
                Edit
              </span>
            ) : undefined
          }
          comparison={
            <Comparison
              direction="up"
              value="₦25,000"
              suffix="from last month"
              tone="good"
            />
          }
          onClick={() => setIncomeModalOpen(true)}
        />

        <MetricCard
          compact
          ariaLabel="Remaining allocation"
          label="Remaining"
          value={
            <AnimatedMoney
              value={remaining}
              currency={currency}
              className={net < 0 ? "text-warn" : "text-ink"}
            />
          }
          support={
            hasBudgets
              ? received > 0
                ? `${Math.round(fundedPct * 100)}% of allocatable income`
                : `${fmt(committed)} committed · no income yet`
              : "Set a budget to see what's left"
          }
          progress={
            hasBudgets
              ? {
                  value: Math.min(1, fundedPct),
                  tone: overCommitted ? "warn" : "brand",
                }
              : undefined
          }
          icon={<TargetIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-health-surface text-health-text"
          comparison={
            <Comparison
              direction="down"
              value="₦17,500"
              suffix="from last week"
              tone="bad"
            />
          }
          onClick={() => setRemainingModalOpen(true)}
        />

        <MetricCard
          compact
          ariaLabel="Budgeted"
          label="Budgeted"
          labelExtra={
            <InfoIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
          }
          value={
            <AnimatedMoney
              value={committed}
              currency={currency}
              className={committed > 0 ? "text-ink" : "text-muted"}
            />
          }
          support={
            hasBudgets
              ? received > 0
                ? `${Math.round(fundedPct * 100)}% of allocatable income`
                : `${monthBudgets.length} ${monthBudgets.length === 1 ? "budget" : "budgets"} · no income yet`
              : "Nothing committed yet"
          }
          icon={<WalletIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-savings-surface text-savings-text"
          comparison={
            <Comparison
              direction="down"
              value="₦12,300"
              suffix="from last week"
              tone="good"
            />
          }
          onClick={reviewBudgets}
        />

        <MetricCard
          compact
          ariaLabel="Savings rate"
          label="Savings Rate"
          value={
            savingsRate === null ? (
              <span className="text-muted">—</span>
            ) : (
              <>
                <AnimatedNumber
                  value={savingsRate}
                  className={
                    savingsRate >= 0 ? "text-income" : "text-expense"
                  }
                />
                <span
                  className={
                    savingsRate >= 0 ? "text-income" : "text-expense"
                  }
                >
                  %
                </span>
              </>
            )
          }
          support={
            savingsRate === null
              ? "Add income to see your savings rate"
              : net >= 0
                ? `${fmt(remaining)} remaining`
                : `Overspend of ${fmt(Math.abs(net))} this month`
          }
          icon={<TrendingUpIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-remaining-surface text-remaining-text"
          comparison={
            <Comparison
              direction="down"
              value="2%"
              suffix="from last month"
              tone="bad"
            />
          }
          onClick={() => setNetModalOpen(true)}
        />
      </div>

      <IncomeModal
        key={String(incomeModalOpen)}
        month={month}
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
      />

      <Modal
        open={netModalOpen}
        onClose={() => setNetModalOpen(false)}
        title="Financial summary"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg bg-canvas px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <ArrowDownLeftIcon className="h-4 w-4 text-income" />
              Received income
            </span>
            <span className="text-sm font-semibold tabular-nums text-income">
              +{fmt(received)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-canvas px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <ArrowDownLeftIcon className="h-4 w-4 text-muted" />
              Expected income
            </span>
            <span className="text-sm font-semibold tabular-nums text-ink">
              {fmt(expected)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-canvas px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <ArrowDownLeftIcon
                className={`h-4 w-4 ${difference >= 0 ? "text-muted" : "text-warn"}`}
              />
              Difference
            </span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                difference >= 0 ? "text-muted" : "text-warn"
              }`}
            >
              {difference >= 0 ? "+" : "−"}
              {fmt(Math.abs(difference))}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-canvas px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <ArrowUpRightIcon className="h-4 w-4 text-expense" />
              Expenses
            </span>
            <span className="text-sm font-semibold tabular-nums text-expense">
              -{fmt(expenses)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <TrendingUpIcon
                className={`h-4 w-4 ${
                  net >= 0 ? "text-income" : "text-expense"
                }`}
              />
              Net
            </span>
            <span
              className={`text-base font-bold tabular-nums ${
                net >= 0 ? "text-income" : "text-expense"
              }`}
            >
              {net >= 0 ? "+" : "-"}
              {fmt(Math.abs(net))}
            </span>
          </div>
          <p className="text-xs text-muted">
            Net is received income minus expenses for {formatMonthLabel(month)}.
          </p>
        </div>
      </Modal>

      <Drawer
        open={remainingModalOpen}
        onClose={() => setRemainingModalOpen(false)}
        title="Allocate remaining"
      >
        {hasBudgets ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Pick the category to add funds to.
            </p>
            {allocationTargets.map((entry) => (
              <button
                key={entry.budget.id}
                type="button"
                onClick={() => {
                  setRemainingModalOpen(false);
                  setAllocating({
                    budgetId: entry.budget.id,
                    categoryId: entry.budget.categoryId,
                    categoryName: categoryLabelOr(entry.category?.name, "Category"),
                  });
                }}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-canvas/40 p-4 text-left transition-colors duration-150 ease-premium hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                  style={{
                    backgroundColor: `${entry.category?.color ?? "#0ea5e9"}1f`,
                  }}
                >
                  {categoryDisplay(entry.category).icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {categoryLabelOr(entry.category?.name, "Category")}
                </span>
                <span
                  className={`shrink-0 text-caption font-semibold tabular-nums ${
                    entry.over > 0 ? "text-danger" : "text-muted"
                  }`}
                >
                  {entry.over > 0
                    ? `${fmt(entry.over)} over`
                    : `${fmt(entry.available)} left`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Set a budget first — then you can allocate what&apos;s left across it.
          </p>
        )}
      </Drawer>

      <AllocationDrawer
        open={allocating !== null}
        month={month}
        target={allocating}
        onClose={() => setAllocating(null)}
      />
    </>
  );
}
