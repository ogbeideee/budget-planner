"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { InsightList } from "@/components/insights/InsightList";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import type { RecommendationType } from "@/components/ui/RecommendationCard";
import {
  AlertTriangleIcon,
  CheckIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import { insightsFor } from "@/lib/insights";
import type { InsightTone } from "@/lib/insights";
import { formatMonthLabel } from "@/lib/date";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const TONE_TO_TYPE: Record<InsightTone, RecommendationType> = {
  danger: "critical",
  warn: "warning",
  success: "success",
  neutral: "information",
};

const TONE_ICON: Record<InsightTone, ReactNode> = {
  danger: <AlertTriangleIcon className="h-6 w-6" />,
  warn: <AlertTriangleIcon className="h-6 w-6" />,
  success: <CheckIcon className="h-6 w-6" />,
  neutral: <SparklesIcon className="h-6 w-6" />,
};

export function TodayRecommendations({ month }: { month: Month }) {
  const router = useRouter();
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const insights = useMemo(
    () =>
      insightsFor({
        budgets,
        transactions,
        categories,
        futureExpenses,
        incomePlans,
        month,
        currency,
      }),
    [budgets, transactions, categories, futureExpenses, incomePlans, month, currency],
  );

  const monthLabel = formatMonthLabel(month);
  const main = insights[0];

  if (!main) return null;

  const rest = insights.slice(1);
  const isOnboarding = main.id === "no-data";

  const card = isOnboarding ? (
    <RecommendationCard
      type="information"
      icon={<SparklesIcon className="h-6 w-6" />}
      title={`Ready to plan ${monthLabel}?`}
      description="Set your monthly income and you'll get recommendations here."
    />
  ) : (
    <RecommendationCard
      type={TONE_TO_TYPE[main.tone]}
      icon={TONE_ICON[main.tone]}
      title={main.title}
      description={main.detail}
      action={
        main.action ? (
          <Button
            onClick={() => router.push(main.action!.href)}
            className="shrink-0"
          >
            {main.action.label}
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {card}
      {rest.length > 0 && (
        <Disclosure
          id={`recommendations-more:${month}`}
          title={`${rest.length} more recommendation${rest.length === 1 ? "" : "s"}`}
          variant="quiet"
        >
          <InsightList month={month} skip={1} />
        </Disclosure>
      )}
    </div>
  );
}
