"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
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

type TaskFilter = "all" | "attention" | "completed";

const FILTER_OPTIONS: Array<{ value: TaskFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "completed", label: "Completed" },
];

const TONE_STYLES: Record<
  TodoItem["tone"],
  {
    icon: (props: IconProps) => ReactNode;
    iconTileClass: string;
    iconClass: string;
    chipLabel: string;
    chipClass: string;
    rowClass: string;
  }
> = {
  danger: {
    icon: AlertTriangleIcon,
    iconTileClass: "bg-danger/10",
    iconClass: "text-danger",
    chipLabel: "High priority",
    chipClass: "bg-danger/10 text-danger",
    rowClass: "border-danger/20 bg-danger/[0.05]",
  },
  warn: {
    icon: AlertTriangleIcon,
    iconTileClass: "bg-warn/10",
    iconClass: "text-warn",
    chipLabel: "Medium priority",
    chipClass: "bg-warn/10 text-warn",
    rowClass: "border-warn/20 bg-warn/[0.05]",
  },
  success: {
    icon: CheckIcon,
    iconTileClass: "bg-income/10",
    iconClass: "text-income",
    chipLabel: "On track",
    chipClass: "bg-income/10 text-income",
    rowClass: "border-income/20 bg-income/[0.05]",
  },
  neutral: {
    icon: DotIcon,
    iconTileClass: "bg-muted/10",
    iconClass: "text-muted",
    chipLabel: "Normal",
    chipClass: "bg-muted/10 text-muted",
    rowClass: "border-border/60 bg-surface",
  },
};

const RESOLVE_CLASSES =
  "inline-flex min-h-9 shrink-0 items-center rounded-lg bg-brand-500/10 px-3.5 text-sm font-semibold text-brand-600 transition-colors duration-150 ease-premium hover:bg-brand-500/15 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400";

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

  const [filter, setFilter] = useState<TaskFilter>("all");

  const attentionItems = items.filter(
    (item) => item.tone === "danger" || item.tone === "warn",
  );
  const highPriorityCount = items.filter((item) => item.tone === "danger").length;
  const completedCount = 0;
  const visibleItems =
    filter === "all"
      ? items
      : filter === "attention"
        ? attentionItems
        : [];

  const allCaughtUp = (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border/60 bg-surface/50 px-6 py-8 text-center">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-500"
      >
        <CheckIcon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-ink">You&apos;re all caught up.</p>
      <p className="text-sm text-muted">
        Nothing else needs your attention this month.
      </p>
      <Link
        href="/"
        className={`${RESOLVE_CLASSES} mt-2`}
      >
        View Planner
      </Link>
    </div>
  );

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.06),transparent_65%)]" />
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05),transparent_65%)]" />
        <svg
          className="absolute right-10 top-20 hidden select-none md:block"
          width="280"
          height="160"
          viewBox="0 0 280 160"
          fill="none"
        >
          <circle cx="224" cy="34" r="48" stroke="rgba(14,165,164,0.12)" strokeWidth="2" />
          <circle cx="224" cy="34" r="28" stroke="rgba(14,165,164,0.14)" strokeWidth="2" />
          <path
            d="M32 138 C 90 132, 114 90, 166 86 C 208 82, 232 48, 270 40"
            stroke="rgba(14,165,164,0.2)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M32 152 C 102 146, 132 110, 192 106"
            stroke="rgba(37,99,235,0.13)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col gap-8">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="To-Do"
              description="A short list of what needs your attention this month."
            />
            <MonthPicker value={month} onChange={setMonth} />
          </div>
          <p
            aria-label="To-do summary"
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"
          >
            <span>
              <span className="font-semibold text-ink">{attentionItems.length}</span>{" "}
              {attentionItems.length === 1
                ? "item needs attention"
                : "items need attention"}
            </span>
            <span aria-hidden="true" className="text-muted/50">
              ·
            </span>
            <span>
              <span className="font-semibold text-ink">{completedCount}</span>{" "}
              completed
            </span>
            <span aria-hidden="true" className="text-muted/50">
              ·
            </span>
            <span>
              <span className="font-semibold text-ink">{highPriorityCount}</span>{" "}
              high priority
            </span>
          </p>
        </div>
        <section aria-label={`To-do ${formatMonthLabel(month)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              To-do · {formatMonthLabel(month)}
            </h2>
            <div
              role="group"
              aria-label="Filter tasks"
              className="flex flex-wrap items-center text-sm"
            >
              {FILTER_OPTIONS.map((option, index) => (
                <Fragment key={option.value}>
                  {index > 0 && (
                    <span aria-hidden="true" className="px-1 text-muted/50">
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                    className={`rounded-md px-1.5 py-0.5 transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none ${
                      filter === option.value
                        ? "font-semibold text-brand-600 dark:text-brand-400"
                        : "font-medium text-muted hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                </Fragment>
              ))}
            </div>
          </div>

          {items.length === 0 || visibleItems.length === 0 ? (
            filter === "completed" && items.length > 0 ? (
              <div className="mt-3 flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border/60 bg-surface/50 px-6 py-8 text-center">
                <p className="text-sm font-semibold text-ink">
                  Nothing completed yet.
                </p>
                <p className="text-sm text-muted">
                  Completed tasks will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-3">{allCaughtUp}</div>
            )
          ) : (
            <>
              <ul className="mt-3 flex flex-col gap-2.5">
                {visibleItems.map((item) => {
                  const style = TONE_STYLES[item.tone];
                  const Icon = style.icon;
                  return (
                    <li
                      key={item.id}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition-colors duration-150 ease-premium ${style.rowClass}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.iconTileClass} ${style.iconClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink">
                            {item.title}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${style.chipClass}`}
                          >
                            {style.chipLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted">
                          {item.detail}
                        </p>
                      </div>
                      <Link href={item.href} className={RESOLVE_CLASSES}>
                        Resolve
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3">{allCaughtUp}</div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}