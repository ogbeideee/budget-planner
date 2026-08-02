"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useMonth } from "@/hooks/useMonth";
import { todoFor } from "@/lib/todo";
import type { TodoItem } from "@/lib/todo";
import { useAppStore } from "@/store/useAppStore";

const TONE_STYLES: Record<TodoItem["tone"], { icon: string; accent: string }> = {
  danger: { icon: "⚠", accent: "border-l-expense" },
  warn: { icon: "⚠", accent: "border-l-warn" },
  success: { icon: "✓", accent: "border-l-income" },
  neutral: { icon: "•", accent: "border-l-border" },
};

export function TodoView() {
  const { month, setMonth } = useMonth();
  const state = useAppStore((s) => s.state);

  const items = useMemo(() => todoFor(state, month), [state, month]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="To-Do"
          description="Actions to keep this month on track, drawn from your planner state."
        />
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      <Card title={`To do · ${month}`}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Nothing to do — you&apos;re all set for this month.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const style = TONE_STYLES[item.tone];
              return (
                <li
                  key={item.id}
                  className={`rounded-md border border-border border-l-4 ${style.accent} bg-canvas px-3 py-3`}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 text-sm">
                      {style.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {item.title}
                      </p>
                      <p className="text-sm text-muted">{item.detail}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="shrink-0 text-sm font-semibold text-brand-600 underline-offset-2 hover:underline"
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
