"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatedMoney } from "@/components/ui/AnimatedNumber";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  PencilIcon,
  TargetIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";
import { formatMonthLabel } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import type { Currency, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { AllocationPanel } from "./AllocationPanel";
import { Drawer } from "@/components/ui/Drawer";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { IncomeModal } from "./IncomeModal";

interface SummaryCardProps {
  ariaLabel: string;
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  iconClass: string;
  valueClass?: string;
  accent: string;
  borderHoverClass: string;
  editAffordance?: boolean;
  currency: Currency;
  className?: string;
  onClick: () => void;
}

function SummaryCard({
  ariaLabel,
  label,
  value,
  hint,
  icon,
  iconClass,
  valueClass,
  accent,
  borderHoverClass,
  editAffordance = false,
  currency,
  className = "",
  onClick,
}: SummaryCardProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-border/50 bg-surface p-5 text-left shadow-card transition-all duration-200 ease-premium hover:-translate-y-1 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus:outline-none motion-reduce:transform-none ${borderHoverClass} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] ${accent}`}
      />
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 ease-premium group-hover:scale-105 ${iconClass}`}
          >
            {icon}
          </span>
          <span className="min-w-0 text-sm font-semibold leading-snug text-muted group-hover:text-ink">
            {label}
          </span>
        </span>
        {editAffordance ? (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-canvas px-2 text-xs font-semibold text-muted transition-colors duration-200 ease-premium group-hover:border-brand-500/40 group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-brand-950 dark:group-hover:text-brand-300">
            <PencilIcon className="h-3 w-3" />
            Edit
          </span>
        ) : (
          <ChevronRightIcon className="hidden h-4 w-4 shrink-0 -translate-x-1 text-muted opacity-0 transition-all duration-200 ease-premium group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block motion-reduce:transition-none" />
        )}
      </span>
      <AnimatedMoney
        value={value}
        currency={currency}
        className={`text-[1.75rem] font-bold leading-9 tracking-tight tabular-nums ${valueClass ?? ""}`}
      />
      <span className="text-xs font-medium leading-tight text-muted/80">
        {hint}
      </span>
    </button>
  );
}

export function SummaryCards({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expensesModalOpen, setExpensesModalOpen] = useState(false);
  const [netModalOpen, setNetModalOpen] = useState(false);
  const [remainingModalOpen, setRemainingModalOpen] = useState(false);

  const {
    received,
    expected,
    expenses,
    net,
    remaining,
  } = useMemo(
    () => monthFinance(transactions, incomePlans, month),
    [transactions, incomePlans, month],
  );
  const difference = expected - received;
  const monthBudgets = useMemo(
    () => budgets.filter((budget) => budget.month === month),
    [budgets, month],
  );
  const hasBudgets = monthBudgets.length > 0;
  const committed = useMemo(
    () => monthBudgets.reduce((sum, budget) => sum + budget.limit, 0),
    [monthBudgets],
  );
  const allocatable = remaining;
  const fundedPct =
    allocatable > 0 ? committed / allocatable : committed > 0 ? 1 : 0;
  const overCommitted = allocatable > 0 && committed > allocatable;

  const fmt = (value: number) => formatMoney(value, currency);

  return (
    <>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-live="polite"
      >
        <button
          type="button"
          aria-label="Remaining allocation"
          onClick={() => setRemainingModalOpen(true)}
          className={`group relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/[0.08] via-surface to-surface p-6 text-left shadow-card transition-all duration-200 ease-premium hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus:outline-none motion-reduce:transform-none sm:col-span-2 lg:col-span-2 lg:row-span-2`}
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600/80 to-brand-400/60"
          />
          <span className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 shadow-sm transition-transform duration-200 ease-premium group-hover:scale-105 dark:text-brand-400"
              >
                <TargetIcon className="h-5 w-5" />
              </span>
              <span className="shrink-0 text-sm font-semibold leading-snug text-muted group-hover:text-ink">
                Remaining
              </span>
            </span>
            <ChevronRightIcon className="hidden h-4 w-4 shrink-0 -translate-x-1 text-muted opacity-0 transition-all duration-200 ease-premium group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block motion-reduce:transition-none" />
          </span>
          <AnimatedMoney
            value={remaining}
            currency={currency}
            className={`text-4xl font-bold leading-none tracking-tight tabular-nums ${
              net < 0 ? "text-warn" : "text-ink"
            }`}
          />
          {hasBudgets ? (
            <span className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-muted">
                  {fmt(committed)} committed of {fmt(allocatable)} allocatable
                </span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    overCommitted ? "text-warn" : "text-muted"
                  }`}
                >
                  {Math.round(Math.min(1, fundedPct) * 100)}%
                </span>
              </span>
              <ProgressBar
                value={Math.min(1, fundedPct)}
                tone={overCommitted ? "warn" : "brand"}
              />
            </span>
          ) : (
            <span className="text-xs font-medium leading-tight text-muted/80">
              What&apos;s left to allocate · set a budget to see how it divides
            </span>
          )}
        </button>

        <SummaryCard
          ariaLabel={
            expected > 0 ? "Expected income" : "Set expected income"
          }
          label={expected > 0 ? "Expected income" : "Set expected income"}
          value={expected}
          hint={
            expected > 0
              ? `Received ${fmt(received)} · ${difference >= 0 ? "+" : "−"}${fmt(Math.abs(difference))} ${difference >= 0 ? "to collect" : "over received"}`
              : received > 0
                ? `Received ${fmt(received)} — plan what you expect`
                : "Set what you expect to earn this month"
          }
          icon={<ArrowDownLeftIcon className="h-5 w-5" />}
          iconClass="bg-income/10 text-income"
          valueClass={expected > 0 ? "text-income" : "text-muted"}
          accent="bg-income/70"
          borderHoverClass="hover:border-income/40"
          editAffordance
          currency={currency}
          onClick={() => setIncomeModalOpen(true)}
        />
        <SummaryCard
          ariaLabel="Expense breakdown"
          label="Expenses"
          value={expenses}
          hint="See the full breakdown"
          icon={<ArrowUpRightIcon className="h-5 w-5" />}
          iconClass="bg-expense/10 text-expense"
          valueClass="text-expense"
          accent="bg-expense/70"
          borderHoverClass="hover:border-expense/40"
          currency={currency}
          onClick={() => setExpensesModalOpen(true)}
        />
        <SummaryCard
          ariaLabel="Net summary"
          label="Net"
          value={net}
          hint="Income minus expenses"
          icon={<TrendingUpIcon className="h-5 w-5" />}
          iconClass={
            net >= 0 ? "bg-income/10 text-income" : "bg-expense/10 text-expense"
          }
          valueClass={net >= 0 ? "text-income" : "text-expense"}
          accent={net >= 0 ? "bg-income/70" : "bg-expense/70"}
          borderHoverClass={
            net >= 0 ? "hover:border-income/40" : "hover:border-expense/40"
          }
          currency={currency}
          className="sm:col-span-2 lg:col-span-2"
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
        open={expensesModalOpen}
        onClose={() => setExpensesModalOpen(false)}
        title="Where your money went"
      >
        <ExpenseBreakdown month={month} bare />
      </Modal>

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