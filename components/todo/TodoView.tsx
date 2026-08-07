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
  { icon: (props: IconProps) => ReactNode; iconClass: string }
> = {
  danger: { icon: AlertTriangleIcon, iconClass: "text-danger" },
  warn: { icon: AlertTriangleIcon, iconClass: "text-warn" },
  success: { icon: CheckIcon, iconClass: "text-income" },
  neutral: { icon: DotIcon, iconClass: "text-muted" },
};

export function TodoView() {
  const { month, setMonth } = useMonth();
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const settings = useAppStore((s) => s.state.settings);

  const items = useMemo(
    () => todoFor({ budgets, transactions, categories, incomePlans, settings }, month),
    [budgets, transactions, categories, incomePlans, settings, month],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="To-Do"
          description="A short list of what needs your attention this month."
        />
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <Card title={`To do · ${formatMonthLabel(month)}`}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            All clear — nothing needs your attention this month.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {items.map((item) => {
              const style = TONE_STYLES[item.tone];
              const Icon = style.icon;
              return (
                <li key={item.id} className="group flex items-start gap-3 py-3.5">
                  <span aria-hidden="true" className={`mt-0.5 ${style.iconClass}`}>
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
                    className="inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-brand-600 underline-offset-2 transition-colors duration-150 ease-premium hover:bg-brand-500/10 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400"
                  >
                    Resolve
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
