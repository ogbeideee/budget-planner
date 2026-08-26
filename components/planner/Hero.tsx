"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  CalendarIcon,
  ChartIcon,
  TargetIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";
import {
  currentMonthKey,
  daysInMonth,
  isoToDate,
  parseMonth,
  todayIso,
} from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import type { Currency, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useDisplayName } from "@/store/useDisplayName";
import { REVIEW_BUDGETS_HREF, scrollToBudgetAllocation } from "./reviewBudgets";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function money(value: number, currency: Currency): string {
  return formatMoney(value, currency);
}

export function Hero({ month }: { month: Month }) {
  const router = useRouter();
  const transactions = useAppStore((s) => s.state.transactions);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const displayName = useDisplayName((s) => s.name);

  const finance = useMemo(
    () => monthFinance(transactions, incomePlans, month),
    [transactions, incomePlans, month],
  );

  const dateLine = useMemo(() => {
    const iso = month === currentMonthKey() ? todayIso() : `${month}-01`;
    return isoToDate(iso).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [month]);

  const monthName = useMemo(
    () => isoToDate(`${month}-01`).toLocaleDateString("en-US", { month: "long" }),
    [month],
  );

  const { daysLeft, monthState } = useMemo(() => {
    const current = currentMonthKey();
    const { year, monthIndex } = parseMonth(month);
    const total = daysInMonth(year, monthIndex);
    if (month < current) return { daysLeft: 0, monthState: "past" as const };
    if (month > current) return { daysLeft: total, monthState: "future" as const };
    return {
      daysLeft: Math.max(0, total - new Date().getDate()),
      monthState: "current" as const,
    };
  }, [month]);

  const hasExpected = finance.expected > 0;
  const projected = finance.projectedRemaining;

  const dailyAvailable =
    projected >= 0 && daysLeft > 0 ? Math.round(projected / daysLeft) : null;

  const daysCaption = useMemo(() => {
    if (monthState === "past") return "Month complete";
    if (!hasExpected) return "Set expected income to begin";
    if (projected < 0) {
      return `Short by ${money(Math.abs(projected), currency)} this month`;
    }
    if (daysLeft <= 0) return `${money(projected, currency)} available today`;
    return `${money(dailyAvailable ?? 0, currency)}/day available`;
  }, [monthState, hasExpected, projected, daysLeft, dailyAvailable, currency]);

  const receivedPct = hasExpected
    ? Math.round((finance.received / finance.expected) * 100)
    : 0;

  // Same destination as the status band's "Review budgets" button.
  const reviewBudget = () => {
    router.push(REVIEW_BUDGETS_HREF);
    scrollToBudgetAllocation();
  };

  return (
    <section
      aria-label="Monthly overview"
      className="animate-[page-in_220ms_var(--ease-premium)] relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-r from-surface via-surface to-canvas shadow-card"
    >
      {/* Restrained illustration: bounded to ~38% of the card and held at low
          opacity so it reads as a backdrop, never competing with the left
          column. Same artwork as before — only its box, scale and opacity
          changed. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[38%] max-w-[340px] overflow-hidden"
      >
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.07),transparent_65%)]" />
        <svg
          className="absolute right-4 top-1/2 hidden w-full -translate-y-1/2 select-none opacity-70 lg:block"
          viewBox="0 0 400 240"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
        >
          <circle cx="330" cy="70" r="78" fill="rgba(14,165,164,0.03)" />
          <circle cx="330" cy="70" r="48" fill="rgba(14,165,164,0.035)" />
          <circle cx="330" cy="70" r="22" fill="rgba(14,165,164,0.04)" />
          <circle cx="248" cy="178" r="44" fill="rgba(59,130,246,0.02)" />
          <circle cx="248" cy="178" r="20" fill="rgba(59,130,246,0.025)" />
          <path
            d="M56 178 C 106 174, 118 128, 168 126 C 218 124, 234 84, 284 82 C 334 80, 348 48, 398 44"
            stroke="rgba(14,165,164,0.3)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M56 196 C 126 192, 148 160, 208 158 C 268 156, 300 116, 380 112"
            stroke="rgba(37,99,235,0.16)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="398" cy="44" r="5" fill="var(--color-brand-500)" opacity="0.5" />
        </svg>
      </div>

      {/* Condensed: padding and the gaps between each block follow the
          reference's proportions (date 6px, greeting 10px, stats 14px,
          progress label 6px, actions 16px) rather than one uniform gap. */}
      <div className="relative z-10 px-6 py-5 sm:px-7 lg:px-8">
        <div className="flex min-w-0 max-w-3xl flex-col">
          <p className="text-caption font-semibold text-muted">{dateLine}</p>

          <h2 className="mt-1.5 text-kpi-tertiary font-bold tracking-tight text-ink">
            {greeting()}
            {displayName ? `, ${displayName}` : ""}
            <span aria-hidden="true">👋</span>
          </h2>

          {!hasExpected ? (
            <p className="mt-2.5 text-description font-medium text-muted">
              Set your expected income to start planning this month.
            </p>
          ) : projected >= 0 ? (
            <p className="mt-2.5 text-description font-medium text-muted">
              You&apos;re on track to finish {monthName} with{" "}
              <span className="font-bold tabular-nums text-ink">
                {money(projected, currency)}
              </span>{" "}
              remaining.
            </p>
          ) : (
            <p className="mt-2.5 text-description font-medium text-muted">
              Planned expenses outpace income — you&apos;d be short by{" "}
              <span className="font-bold tabular-nums text-warn">
                {money(Math.abs(projected), currency)}
              </span>{" "}
              at month-end.
            </p>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="flex items-center gap-1.5 text-description font-medium tabular-nums text-muted">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              {daysLeft} {daysLeft === 1 ? "day" : "days"} remaining
            </span>
            <span className="flex items-center gap-1.5 text-description font-medium tabular-nums text-muted">
              <TrendingUpIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              {daysCaption}
            </span>
          </div>

          <div className="mt-3.5 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-caption font-medium tabular-nums text-muted">
                {hasExpected
                  ? `${receivedPct}% of expected income received`
                  : "Set expected income to begin"}
              </span>
              {hasExpected && (
                <span className="shrink-0 text-caption font-medium tabular-nums text-muted">
                  {money(finance.received, currency)} /{" "}
                  {money(finance.expected, currency)}
                </span>
              )}
            </div>
            <ProgressBar
              value={receivedPct / 100}
              thin
              tone={receivedPct >= 100 ? "success" : "brand"}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button icon={<TargetIcon className="h-4 w-4" />} onClick={reviewBudget}>
              Review Budget
            </Button>
            <Button
              variant="secondary"
              icon={<ChartIcon className="h-4 w-4" />}
              onClick={() => router.push("/reports")}
            >
              View Reports
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
