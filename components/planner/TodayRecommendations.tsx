"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  DotIcon,
  SparklesIcon,
  type IconProps,
} from "@/components/ui/icons";
import { insightsFor } from "@/lib/insights";
import type { InsightTone } from "@/lib/insights";
import { formatMonthLabel } from "@/lib/date";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const TONES: Record<
  InsightTone,
  {
    icon: (props: IconProps) => ReactNode;
    iconWrap: string;
    dot: string;
  }
> = {
  danger: {
    icon: AlertTriangleIcon,
    iconWrap: "border-danger/25 bg-danger/10 text-danger",
    dot: "bg-danger",
  },
  warn: {
    icon: AlertTriangleIcon,
    iconWrap: "border-warn/25 bg-warn/10 text-warn",
    dot: "bg-warn",
  },
  success: {
    icon: CheckIcon,
    iconWrap: "border-income/25 bg-income/10 text-income",
    dot: "bg-income",
  },
  neutral: {
    icon: DotIcon,
    iconWrap: "border-border bg-canvas text-muted",
    dot: "bg-muted",
  },
};

export function TodayRecommendations({ month }: { month: Month }) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const recommendations = useMemo(
    () =>
      insightsFor({ budgets, transactions, categories, month, currency }).filter(
        (insight) => insight.action,
      ),
    [budgets, transactions, categories, month, currency],
  );

  const hasData = useMemo(
    () =>
      transactions.some((transaction) => transaction.date.startsWith(month)) ||
      budgets.some((budget) => budget.month === month),
    [transactions, budgets, month],
  );

  const hasPlans = recommendations.length === 0;

  return (
    <Card
      title="Today's recommendations"
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
          <SparklesIcon className="h-3.5 w-3.5" />
          {formatMonthLabel(month)}
        </span>
      }
    >
      {hasPlans ? (
        <div className="flex animate-[list-in_200ms_ease-out] items-center gap-3 rounded-xl border border-border/70 bg-canvas px-4 py-3">
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
              hasData
                ? "border-income/25 bg-income/10 text-income"
                : "border-border bg-surface text-brand-600 dark:text-brand-400"
            }`}
          >
            {hasData ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {hasData ? "Nothing to fix" : "Ready when you are"}
            </p>
            <p className="text-sm text-muted">
              {hasData
                ? "No pressing actions for " + formatMonthLabel(month) + "."
                : "Set your monthly income to unlock recommendations for " +
                  formatMonthLabel(month) +
                  "."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {recommendations.map((insight, index) => {
            const tone = TONES[insight.tone];
            const Icon = tone.icon;
            return (
              <li
                key={insight.id}
                className="flex animate-[list-in_200ms_ease-out] items-center gap-3 rounded-xl border border-border/70 bg-canvas px-3.5 py-3 transition-colors duration-200 hover:border-border"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${tone.iconWrap}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
                    />
                    {insight.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                    {insight.detail}
                  </p>
                </div>
                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand-600 shadow-card transition-all duration-200 hover:-translate-y-px hover:shadow-card-hover hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    {insight.action.label}
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}