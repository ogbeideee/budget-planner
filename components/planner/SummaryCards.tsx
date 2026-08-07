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
  ArrowUpRightIcon,
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
import { useAppStore } from "@/store/useAppStore";
import { AllocationPanel } from "./AllocationPanel";
import { IncomeModal } from "./IncomeModal";

export function SummaryCards({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [netModalOpen, setNetModalOpen] = useState(false);
  const [remainingModalOpen, setRemainingModalOpen] = useState(false);

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
    () => monthBudgets.reduce((sum, budget) => sum + budget.limit, 0),
    [monthBudgets],
  );
  const fundedPct = received > 0 ? committed / received : 0;
  const overCommitted = committed > received;

  const fmt = (value: number) => formatMoney(value, currency);

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
          onClick={() => setIncomeModalOpen(true)}
        />

        <MetricCard
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
                ? `${fmt(committed)} committed · ${Math.round(fundedPct * 100)}% of allocatable`
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
          onClick={() => setRemainingModalOpen(true)}
        />

        <MetricCard
          ariaLabel="Budgeted"
          label="Budgeted"
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
                ? `${monthBudgets.length} ${monthBudgets.length === 1 ? "budget" : "budgets"} · ${Math.round(fundedPct * 100)}% of allocatable`
                : `${monthBudgets.length} ${monthBudgets.length === 1 ? "budget" : "budgets"} · no income yet`
              : "Nothing committed yet"
          }
          icon={<WalletIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-savings-surface text-savings-text"
          onClick={reviewBudgets}
        />

        <MetricCard
          ariaLabel="Savings rate"
          label="Savings Rate"
          value={
            savingsRate === null ? (
              <span className="text-muted">—</span>
            ) : (
              <AnimatedNumber
                value={savingsRate}
                className={
                  savingsRate >= 0 ? "text-income" : "text-expense"
                }
              />
            )
          }
          support={
            savingsRate === null
              ? "Add income to see your savings rate"
              : net >= 0
                ? `You keep ${fmt(net)} after expenses`
                : `Overspend of ${fmt(Math.abs(net))} this month`
          }
          icon={<TrendingUpIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-remaining-surface text-remaining-text"
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
          <AllocationPanel month={month} bare />
        ) : (
          <p className="text-sm text-muted">
            Set a budget first — then you can allocate what&apos;s left across it.
          </p>
        )}
      </Drawer>
    </>
  );
}
