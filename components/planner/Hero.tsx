"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ChartIcon, TargetIcon } from "@/components/ui/icons";
import { currentMonthKey, formatMonthLabel, isoToDate, todayIso } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { monthStats } from "@/lib/monthStats";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Hero({ month }: { month: Month }) {
  const router = useRouter();
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const stats = useMemo(
    () =>
      monthStats({
        month,
        transactions,
        budgets,
        categories,
        futureExpenses,
        incomePlans,
      }),
    [month, transactions, budgets, categories, futureExpenses, incomePlans],
  );

  const dateLine = useMemo(() => {
    const iso = month === currentMonthKey() ? todayIso() : `${month}-01`;
    return isoToDate(iso).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [month]);

  const projected = stats.projectedRemaining;

  const reviewBudget = () => {
    document
      .getElementById("budget-allocation")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      aria-label="Monthly overview"
      className="animate-[page-in_220ms_var(--ease-premium)] relative flex min-h-[220px] w-full items-center overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-surface via-surface to-canvas shadow-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_88%_15%,rgba(14,165,164,0.09),transparent_62%)]"
      />
      <div className="relative z-10 flex max-w-2xl flex-col gap-3 px-6 py-5 lg:pr-16">
        <p className="text-caption font-medium text-muted">{dateLine}</p>
        <div className="flex flex-col gap-2">
          <h2 className="text-section-title font-bold tracking-tight text-ink">
            {greeting()}
            <span className="text-muted"> · {formatMonthLabel(month)}</span>
          </h2>
          {projected === null ? (
            <p className="text-description font-medium text-muted">
              Set your expected income to start planning this month.
            </p>
          ) : projected >= 0 ? (
            <p className="text-description font-medium text-muted">
              You&apos;re on track to finish the month with a projected{" "}
              <span className="font-bold tabular-nums text-ink">
                {formatMoney(projected, currency)}
              </span>{" "}
              remaining.
            </p>
          ) : (
            <p className="text-description font-medium text-muted">
              Planned expenses outpace income — you&apos;d be short by{" "}
              <span className="font-bold tabular-nums text-warn">
                {formatMoney(Math.abs(projected), currency)}
              </span>{" "}
              at month-end.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            icon={<TargetIcon className="h-4 w-4" />}
            onClick={reviewBudget}
          >
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

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 select-none lg:block"
      >
        <svg
          width="420"
          height="220"
          viewBox="0 0 420 220"
          fill="none"
          className="opacity-90"
        >
          <circle cx="330" cy="56" r="72" fill="rgba(14,165,164,0.07)" />
          <circle cx="330" cy="56" r="44" fill="rgba(14,165,164,0.08)" />
          <circle cx="330" cy="56" r="20" fill="rgba(14,165,164,0.1)" />
          <circle cx="252" cy="158" r="40" fill="rgba(59,130,246,0.06)" />
          <circle cx="252" cy="158" r="18" fill="rgba(59,130,246,0.08)" />
          <path
            d="M60 172 C 110 168, 120 120, 170 118 C 220 116, 235 74, 285 72 C 335 70, 348 40, 398 36"
            stroke="rgba(14,165,164,0.35)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M60 190 C 130 186, 150 152, 210 150 C 270 148, 300 108, 380 104"
            stroke="rgba(37,99,235,0.18)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="398" cy="36" r="6" fill="#0EA5A4" />
        </svg>
      </div>
    </section>
  );
}
