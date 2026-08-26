"use client";

import { useMemo } from "react";
import { AnimatedMoney } from "@/components/ui/AnimatedNumber";
import { MetricCard } from "@/components/ui/MetricCard";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  TargetIcon,
  TrendDownIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";
import { formatMonthShort, monthOffset } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import type { Currency, IncomePlan, Month, Transaction } from "@/lib/types";

interface OverviewProps {
  month: Month;
  transactions: Transaction[];
  incomePlans: IncomePlan[];
  currency: Currency;
  compare?: boolean;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function DeltaLine({
  delta,
  good,
  currency,
  pct = false,
}: {
  delta: number | null;
  good: boolean;
  currency: Currency;
  pct?: boolean;
}) {
  if (delta === null) return null;
  const value = pct
    ? `${Math.abs(delta)}%`
    : formatMoney(Math.abs(delta), currency);
  return (
    <span
      className={`text-caption font-semibold tabular-nums ${
        good ? "text-income" : "text-expense"
      }`}
    >
      {delta >= 0 ? "↑" : "↓"} {value} from last month
    </span>
  );
}

function TrendChip({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-bold tabular-nums ${
        up
          ? "bg-success-surface text-success-text"
          : "bg-expense-surface text-danger-text"
      }`}
    >
      {up ? <TrendingUpIcon className="h-3 w-3" /> : <TrendDownIcon className="h-3 w-3" />}
      {Math.abs(delta)}%
    </span>
  );
}

function CompareStrip({
  current,
  previous,
  month,
  currency,
}: {
  current: ReturnType<typeof monthFinance>;
  previous: ReturnType<typeof monthFinance>;
  month: Month;
  currency: Currency;
}) {
  const fmt = (value: number) => formatMoney(value, currency);
  const rows: Array<{ label: string; current: string; previous: string }> = [
    { label: "Total income", current: fmt(current.received), previous: fmt(previous.received) },
    { label: "Total expenses", current: fmt(current.expenses), previous: fmt(previous.expenses) },
    { label: "Net savings", current: fmt(current.net), previous: fmt(previous.net) },
    {
      label: "Savings rate",
      current: current.savingsRate !== null ? `${current.savingsRate}%` : "—",
      previous: previous.savingsRate !== null ? `${previous.savingsRate}%` : "—",
    },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-canvas/40 p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-ink">
          Comparing {formatMonthShort(month)} vs {formatMonthShort(monthOffset(month, -1))}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <span className="text-caption font-medium text-muted">{row.label}</span>
            <span className="text-base font-bold tabular-nums text-ink">{row.current}</span>
            <span className="text-xs font-medium tabular-nums text-muted">
              {formatMonthShort(monthOffset(month, -1))}: {row.previous}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyOverview({
  month,
  transactions,
  incomePlans,
  currency,
  compare = false,
}: OverviewProps) {
  const current = useMemo(
    () => monthFinance(transactions, incomePlans, month),
    [transactions, incomePlans, month],
  );
  const previous = useMemo(
    () => monthFinance(transactions, incomePlans, monthOffset(month, -1)),
    [transactions, incomePlans, month],
  );

  const incomeDelta = pctDelta(current.received, previous.received);
  const expensesDelta = pctDelta(current.expenses, previous.expenses);
  const netDelta =
    previous.net > 0 ? pctDelta(current.net, previous.net) : null;
  const incomeDeltaAmount =
    previous.received > 0 ? current.received - previous.received : null;
  const expensesDeltaAmount =
    previous.expenses > 0 ? current.expenses - previous.expenses : null;
  const netDeltaAmount =
    previous.net !== 0 || current.net !== 0
      ? current.net - previous.net
      : null;
  const rateDeltaPoints =
    previous.savingsRate !== null && current.savingsRate !== null
      ? current.savingsRate - previous.savingsRate
      : null;
  const cardChrome = "shadow-none hover:shadow-none";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total income"
          value={<AnimatedMoney value={current.received} currency={currency} />}
          chip={<TrendChip delta={incomeDelta} />}
          icon={<ArrowDownLeftIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-success-surface text-success-text"
          className={cardChrome}
          support={
            incomeDeltaAmount !== null ? (
              <DeltaLine
                delta={incomeDeltaAmount}
                good={incomeDeltaAmount >= 0}
                currency={currency}
              />
            ) : (
              "Record income to start comparing"
            )
          }
        />
        <MetricCard
          label="Total expenses"
          value={<AnimatedMoney value={current.expenses} currency={currency} />}
          chip={<TrendChip delta={expensesDelta} />}
          icon={<ArrowUpRightIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-expense-surface text-danger-text"
          className={cardChrome}
          support={
            expensesDeltaAmount !== null ? (
              <DeltaLine
                delta={expensesDeltaAmount}
                good={expensesDeltaAmount <= 0}
                currency={currency}
              />
            ) : (
              "No prior month to compare yet"
            )
          }
        />
        <MetricCard
          label="Net savings"
          value={<AnimatedMoney value={current.net} currency={currency} />}
          chip={<TrendChip delta={netDelta} />}
          icon={<TrendingUpIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-savings-surface text-savings-text"
          className={cardChrome}
          support={
            netDeltaAmount !== null ? (
              <DeltaLine
                delta={netDeltaAmount}
                good={netDeltaAmount >= 0}
                currency={currency}
              />
            ) : (
              "Spending more than you earn"
            )
          }
        />
        <MetricCard
          label="Savings rate"
          value={
            current.savingsRate !== null ? `${current.savingsRate}%` : "—"
          }
          icon={<TargetIcon className="h-[18px] w-[18px]" />}
          iconClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          className={cardChrome}
          support={
            rateDeltaPoints !== null ? (
              <DeltaLine
                delta={rateDeltaPoints}
                good={rateDeltaPoints >= 0}
                currency={currency}
                pct
              />
            ) : current.savingsRate !== null ? (
              "of income kept this month"
            ) : (
              "Record income to see your savings rate"
            )
          }
        />
      </div>
      {compare && (
        <CompareStrip
          current={current}
          previous={previous}
          month={month}
          currency={currency}
        />
      )}
    </div>
  );
}
