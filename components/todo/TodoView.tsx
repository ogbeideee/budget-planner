"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  AlertTriangleIcon,
  CheckIcon,
  DotIcon,
  type IconProps,
} from "@/components/ui/icons";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useMonth } from "@/hooks/useMonth";
import { formatMonthLabel } from "@/lib/date";
import { todoFor } from "@/lib/todo";
import type { TodoItem } from "@/lib/todo";
import { useAppStore } from "@/store/useAppStore";

const TONE_STYLES: Record<
  TodoItem["tone"],
  { icon: (props: IconProps) => ReactNode; accent: string }
> = {
  danger: { icon: AlertTriangleIcon, accent: "border-l-expense" },
  warn: { icon: AlertTriangleIcon, accent: "border-l-warn" },
  success: { icon: CheckIcon, accent: "border-l-income" },
  neutral: { icon: DotIcon, accent: "border-l-border" },
};

export function TodoView() {
  const { month, setMonth } = useMonth();
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const settings = useAppStore((s) => s.state.settings);

  const items = useMemo(
    () => todoFor({ budgets, transactions, categories, settings }, month),
    [budgets, transactions, categories, settings, month],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="To-Do"
          description="Actions to keep this month on track, drawn from your planner state."
        />
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <Card title={`To do · ${formatMonthLabel(month)}`}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Nothing to do — you&apos;re all set for this month.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const style = TONE_STYLES[item.tone];
              const Icon = style.icon;
              return (
                <li
                  key={item.id}
                  className={`rounded-md border border-border border-l-4 ${style.accent} bg-canvas px-3 py-3`}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {item.title}
                      </p>
                      <p className="text-sm text-muted">{item.detail}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="shrink-0 rounded-sm text-sm font-semibold text-brand-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400"
                    >
                      Resolve
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
