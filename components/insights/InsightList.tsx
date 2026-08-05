"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  DotIcon,
  type IconProps,
} from "@/components/ui/icons";
import { insightsFor } from "@/lib/insights";
import type { InsightsInput, InsightTone } from "@/lib/insights";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const TONES: Record<
  InsightTone,
  {
    icon: (props: IconProps) => ReactNode;
    iconClass: string;
    rowClass: string;
  }
> = {
  danger: {
    icon: AlertTriangleIcon,
    iconClass: "text-danger",
    rowClass: "bg-danger/[0.06]",
  },
  warn: {
    icon: AlertTriangleIcon,
    iconClass: "text-warn",
    rowClass: "bg-warn/[0.05]",
  },
  success: {
    icon: CheckIcon,
    iconClass: "text-income",
    rowClass: "bg-income/[0.05]",
  },
  neutral: {
    icon: DotIcon,
    iconClass: "text-muted",
    rowClass: "bg-canvas",
  },
};

export interface InsightListProps {
  month: Month;
  actionsOnly?: boolean;
  limit?: number;
  input?: InsightsInput;
}

export function InsightList({
  month,
  actionsOnly = false,
  limit,
  input,
}: InsightListProps) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const insights = useMemo(() => {
    const all = insightsFor(
      input ?? {
        budgets,
        transactions,
        categories,
        futureExpenses,
        incomePlans,
        month,
        currency,
      },
    );
    const filtered = actionsOnly ? all.filter((insight) => insight.action) : all;
    return limit === undefined ? filtered : filtered.slice(0, limit);
  }, [
    budgets,
    transactions,
    categories,
    futureExpenses,
    incomePlans,
    month,
    currency,
    actionsOnly,
    limit,
    input,
  ]);

  if (insights.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {insights.map((insight, index) => {
        const tone = TONES[insight.tone];
        const Icon = tone.icon;
        return (
          <li
            key={insight.id}
            className={`flex animate-[list-in_200ms_var(--ease-premium)] items-center gap-3 rounded-lg px-3.5 py-3 ${tone.rowClass}`}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span aria-hidden="true" className={tone.iconClass}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold text-ink">{insight.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                {insight.detail}
              </p>
            </div>
            {insight.action && (
              <Link
                href={insight.action.href}
                className="flex shrink-0 items-center gap-1 rounded-sm text-sm font-semibold text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400 dark:hover:text-brand-300"
              >
                {insight.action.label}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
