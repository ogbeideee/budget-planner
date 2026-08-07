"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckIcon,
  ChevronDownIcon,
  TargetIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { monthKeyFromIso } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { spendingByCategory } from "@/lib/selectors";
import type {
  Budget,
  Category,
  Currency,
  FutureExpense,
  IncomePlan,
  Month,
  Transaction,
} from "@/lib/types";

type RecoType = "warning" | "information" | "success";

interface RecommendationItem {
  key: string;
  type: RecoType;
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

const STYLES: Record<RecoType, string> = {
  warning: "bg-reco-warning border-reco-warning-border",
  information: "bg-reco-info border-reco-info-border",
  success: "bg-reco-success border-reco-success-border",
};

const ICON_STYLES: Record<RecoType, string> = {
  warning: "bg-upcoming-surface text-warn-text",
  information: "bg-savings-surface text-savings-text",
  success: "bg-success-surface text-success-text",
};

interface RecommendationsProps {
  month: Month;
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  futureExpenses: FutureExpense[];
  incomePlans: IncomePlan[];
  currency: Currency;
}

export function Recommendations({
  month,
  budgets,
  categories,
  transactions,
  futureExpenses,
  incomePlans,
  currency,
}: RecommendationsProps) {
  const router = useRouter();
  const fmt = useCallback(
    (value: number) => formatMoney(value, currency),
    [currency],
  );

  const items = useMemo<RecommendationItem[]>(() => {
    const list: RecommendationItem[] = [];
    const spentByCategory = new Map(
      spendingByCategory(transactions, month).map((entry) => [
        entry.categoryId,
        entry.amount,
      ]),
    );

    for (const budget of budgets) {
      if (budget.month !== month || budget.limit <= 0) continue;
      const spent = spentByCategory.get(budget.categoryId) ?? 0;
      if (spent <= budget.limit) continue;
      const category = categories.find((c) => c.id === budget.categoryId);
      list.push({
        key: `over-${budget.id}`,
        type: "warning",
        icon: <AlertTriangleIcon className="h-5 w-5" />,
        title: `"${category?.name ?? "Budget"}" is over budget`,
        description: `You've spent ${fmt(spent)} of ${fmt(budget.limit)} — ${fmt(spent - budget.limit)} over.`,
        action: (
          <Button variant="secondary" size="sm" onClick={() => router.push("/")}>
            Review budget
          </Button>
        ),
      });
    }

    const finance = monthFinance(transactions, incomePlans, month);
    if (finance.received > 0 && finance.received < finance.expected) {
      list.push({
        key: "unallocated-income",
        type: "information",
        icon: <WalletIcon className="h-5 w-5" />,
        title: "Some expected income hasn't arrived",
        description: `You've received ${fmt(finance.received)} of ${fmt(finance.expected)} expected income this month. Keep an eye on it on the planner.`,
        action: (
          <Button variant="secondary" size="sm" onClick={() => router.push("/")}>
            View planner
          </Button>
        ),
      });
    }

    const savingsRate = finance.savingsRate;
    if (savingsRate !== null && savingsRate < 20) {
      list.push({
        key: "savings-rate",
        type: "warning",
        icon: <TargetIcon className="h-5 w-5" />,
        title: `Savings rate is ${savingsRate}%`,
        description: "Aim to keep at least 20% of your income each month.",
        action: (
          <Button variant="secondary" size="sm" onClick={() => router.push("/")}>
            Review budget
          </Button>
        ),
      });
    }

    const bills = futureExpenses.filter(
      (expense) =>
        expense.status === "upcoming" && monthKeyFromIso(expense.dueDate) === month,
    );
    if (bills.length > 0) {
      list.push({
        key: "upcoming-bills",
        type: "information",
        icon: <CalendarClockIcon className="h-5 w-5" />,
        title: `${bills.length} upcoming bill${bills.length === 1 ? "" : "s"} this month`,
        description: `Paying early keeps ${fmt(bills.reduce((sum, bill) => sum + bill.amount, 0))} from piling up.`,
        action: (
          <Button variant="secondary" size="sm" onClick={() => router.push("/upcoming")}>
            View bills
          </Button>
        ),
      });
    }

    if (list.length === 0) {
      list.push({
        key: "on-track",
        type: "success",
        icon: <CheckIcon className="h-5 w-5" />,
        title: "You're on track",
        description: "No issues spotted for this month. Keep it up.",
      });
    }

    return list;
  }, [month, budgets, categories, transactions, futureExpenses, incomePlans, fmt, router]);

  const [openKey, setOpenKey] = useState<string | null>(
    () => items[0]?.key ?? null,
  );

  if (
    transactions.length === 0 &&
    budgets.length === 0 &&
    incomePlans.length === 0
  ) {
    return (
      <Card variant="quiet" className="print-block">
        <EmptyState
          illustration="target"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="Recommendations appear here"
          description="Set budgets and record a little history, and this is where you'll get clear next steps."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const expanded = openKey === item.key;
        return (
          <div
            key={item.key}
            className={`rounded-xl border p-5 transition-shadow duration-default ease-premium hover:shadow-card-hover ${STYLES[item.type]}`}
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpenKey(expanded ? null : item.key)}
              className="flex w-full items-center gap-4 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
            >
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ICON_STYLES[item.type]}`}
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-card-title font-bold tracking-tight text-ink">
                  {item.title}
                </span>
                {expanded && (
                  <span className="mt-1.5 block animate-[list-in_200ms_var(--ease-premium)] text-base font-medium leading-6 text-secondary">
                    {item.description}
                  </span>
                )}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-muted transition-transform duration-default ease-premium ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {expanded && item.action && (
              <div className="mt-3 flex justify-end pl-16">{item.action}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
