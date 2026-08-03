"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import {
  AlertTriangleIcon,
  CheckIcon,
  DotIcon,
  type IconProps,
} from "@/components/ui/icons";
import { insightsFor } from "@/lib/insights";
import type { InsightTone } from "@/lib/insights";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const TONES: Record<
  InsightTone,
  { border: string; icon: (props: IconProps) => ReactNode; iconClass: string }
> = {
  danger: { border: "border-danger/40", icon: AlertTriangleIcon, iconClass: "text-danger" },
  warn: { border: "border-warn/40", icon: AlertTriangleIcon, iconClass: "text-warn" },
  success: { border: "border-income/40", icon: CheckIcon, iconClass: "text-income" },
  neutral: { border: "border-border", icon: DotIcon, iconClass: "text-muted" },
};

export function InsightsPanel({ month }: { month: Month }) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const insights = useMemo(
    () => insightsFor({ budgets, transactions, categories, month, currency }),
    [budgets, transactions, categories, month, currency],
  );

  return (
    <Card title="Insights">
      <ul className="flex flex-col gap-2">
        {insights.map((insight) => {
          const tone = TONES[insight.tone];
          const Icon = tone.icon;
          return (
            <li
              key={insight.id}
              className={`rounded-md border-l-4 bg-canvas px-3 py-2.5 ${tone.border}`}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className={`mt-0.5 ${tone.iconClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{insight.title}</p>
                  <p className="text-sm text-muted">{insight.detail}</p>
                  {insight.action && (
                    <Link
                      href={insight.action.href}
                      className="mt-1 inline-block rounded-sm text-sm font-semibold text-brand-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400"
                    >
                      {insight.action.label}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
