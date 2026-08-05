"use client";

import { useMemo } from "react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { budgetHealth, fundingGaps, healthTier, overBudgetCategories } from "@/lib/selectors";
import { monthFinance } from "@/lib/finance";
import type { HealthTier } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const TIER_TONE: Record<HealthTier, "brand" | "warn" | "danger"> = {
  healthy: "brand",
  watch: "warn",
  risk: "danger",
};

const TIER_LABEL: Record<HealthTier, string> = {
  healthy: "Healthy",
  watch: "Watch",
  risk: "At risk",
};

const TIER_DESCRIPTION: Record<HealthTier, string> = {
  healthy: "Your budget is in great shape.",
  watch: "A few items need attention.",
  risk: "Several budget lines are under pressure.",
};

const TIER_BADGE: Record<HealthTier, string> = {
  healthy: "bg-income/10 text-income",
  watch: "bg-warn/10 text-warn",
  risk: "bg-danger/10 text-danger",
};

const TIER_DOT: Record<HealthTier, string> = {
  healthy: "bg-income",
  watch: "bg-warn",
  risk: "bg-danger",
};

export function BudgetHealthCard({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);

  const health = useMemo(
    () => budgetHealth(budgets, transactions, month, incomePlans),
    [budgets, transactions, month, incomePlans],
  );
  const overCount = useMemo(
    () => overBudgetCategories(budgets, transactions, month).length,
    [budgets, transactions, month],
  );
  const unfundedCount = useMemo(
    () => fundingGaps(budgets, categories, futureExpenses, month).length,
    [budgets, categories, futureExpenses, month],
  );
  const net = useMemo(
    () => monthFinance(transactions, incomePlans, month).net,
    [transactions, incomePlans, month],
  );
  const tier = healthTier(health);
  const animatedHealth = useAnimatedNumber(health);

  const checklist = [
    {
      label: "Budgets within limits",
      ok: overCount === 0,
      status: overCount === 0 ? "On track" : `${overCount} over`,
    },
    {
      label: "Every category funded",
      ok: unfundedCount === 0,
      status:
        unfundedCount === 0 ? "On track" : `${unfundedCount} unfunded`,
    },
    {
      label: "Income covers expenses",
      ok: net >= 0,
      status: net >= 0 ? "On track" : "Shortfall",
    },
  ];

  return (
    <Card title="Budget health">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={health}
              className="text-5xl font-bold tracking-tight tabular-nums text-ink"
            />
            <span className="text-base font-semibold text-muted">/100</span>
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_BADGE[tier]}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[tier]}`}
            />
            {TIER_LABEL[tier]}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <ProgressBar
            value={animatedHealth / 100}
            tone={TIER_TONE[tier]}
            className="h-1"
          />
          <p className="text-xs text-muted">{TIER_DESCRIPTION[tier]}</p>
        </div>
        <ul className="flex flex-col gap-0.5 border-t border-border/50 pt-2">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5"
            >
              <span className="flex items-center gap-2 text-sm text-ink">
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    item.ok ? "bg-income/10 text-income" : "bg-danger/10 text-danger"
                  }`}
                >
                  {item.ok ? (
                    <CheckIcon className="h-3 w-3" />
                  ) : (
                    <XIcon className="h-3 w-3" />
                  )}
                </span>
                {item.label}
              </span>
              <span
                className={`text-xs font-medium ${
                  item.ok ? "text-muted" : "text-danger"
                }`}
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}