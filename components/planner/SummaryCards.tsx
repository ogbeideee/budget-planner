"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  TargetIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";
import { formatMonthLabel } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { totals } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { AllocationPanel } from "./AllocationPanel";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { MonthlyIncomeModal } from "./MonthlyIncomeModal";

interface SummaryCardProps {
  ariaLabel: string;
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  iconClass: string;
  valueClass?: string;
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
  onClick,
}: SummaryCardProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-lg bg-surface p-5 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
          >
            {icon}
          </span>
          <span className="truncate text-sm text-muted">{label}</span>
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted/40 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
      <span className={`text-2xl font-bold tabular-nums ${valueClass ?? ""}`}>
        {value}
      </span>
      <span className="text-xs text-muted">{hint}</span>
    </button>
  );
}

export function SummaryCards({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expensesModalOpen, setExpensesModalOpen] = useState(false);
  const [netModalOpen, setNetModalOpen] = useState(false);
  const [remainingModalOpen, setRemainingModalOpen] = useState(false);

  const { income, expenses, net } = useMemo(
    () => totals(transactions, month),
    [transactions, month],
  );
  const remaining = Math.max(0, net);
  const hasBudgets = useMemo(
    () => budgets.some((budget) => budget.month === month),
    [budgets, month],
  );

  const fmt = (value: number) => formatMoney(value, currency);

  return (
    <>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-live="polite"
      >
        <SummaryCard
          ariaLabel={income > 0 ? "Monthly income" : "Set monthly income"}
          label={income > 0 ? "Income" : "Set monthly income"}
          value={fmt(income)}
          hint={income > 0 ? "Tap to adjust monthly income" : "Define your income to plan"}
          icon={<ArrowDownLeftIcon className="h-4 w-4" />}
          iconClass="bg-income/10 text-income"
          valueClass={income > 0 ? undefined : "text-muted"}
          onClick={() => setIncomeModalOpen(true)}
        />
        <SummaryCard
          ariaLabel="Expense breakdown"
          label="Expenses"
          value={fmt(expenses)}
          hint="Tap for the full breakdown"
          icon={<ArrowUpRightIcon className="h-4 w-4" />}
          iconClass="bg-expense/10 text-expense"
          valueClass="text-expense"
          onClick={() => setExpensesModalOpen(true)}
        />
        <SummaryCard
          ariaLabel="Net summary"
          label="Net"
          value={fmt(net)}
          hint="Income minus expenses"
          icon={<TrendingUpIcon className="h-4 w-4" />}
          iconClass={
            net >= 0 ? "bg-income/10 text-income" : "bg-expense/10 text-expense"
          }
          valueClass={net >= 0 ? "text-income" : "text-expense"}
          onClick={() => setNetModalOpen(true)}
        />
        <SummaryCard
          ariaLabel="Remaining allocation"
          label="Remaining"
          value={fmt(remaining)}
          hint="What's left to allocate"
          icon={<TargetIcon className="h-4 w-4" />}
          iconClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          valueClass={net < 0 ? "text-warn" : undefined}
          onClick={() => setRemainingModalOpen(true)}
        />
      </div>

      <MonthlyIncomeModal
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
              Income
            </span>
            <span className="text-sm font-semibold tabular-nums text-income">
              +{fmt(income)}
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
            Net is income minus expenses for {formatMonthLabel(month)}.
          </p>
        </div>
      </Modal>

      <Modal
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
      </Modal>
    </>
  );
}
