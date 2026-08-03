"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMonthLabel } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { totals } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Hero({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);

  const net = useMemo(
    () => totals(transactions, month).net,
    [transactions, month],
  );
  const monthLabel = formatMonthLabel(month);

  const [greeting, setGreeting] = useState("Good morning");
  useEffect(() => {
    const timer = window.setTimeout(
      () => setGreeting(greetingFor(new Date().getHours())),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="animate-[page-in_200ms_ease-out]">
      <p className="text-sm font-semibold tracking-wide text-brand-600 dark:text-brand-400">
        {greeting}, Archer
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">
        {monthLabel} Budget
      </h1>
      <p className="mt-1.5 text-sm font-medium text-muted">
        <span
          className={`font-semibold tabular-nums ${
            net < 0 ? "text-expense" : "text-ink"
          }`}
        >
          {formatMoney(net, currency)}
        </span>{" "}
        {net >= 0 ? "remaining" : "short"}
      </p>
    </div>
  );
}
