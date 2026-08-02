"use client";

import { useEffect } from "react";
import { currentMonthKey, monthOffset } from "@/lib/date";
import { generateInstances } from "@/lib/recurrence";
import { useAppStore } from "@/store/useAppStore";

export function useRecurring(): void {
  const recurringEnabled = useAppStore(
    (s) => s.state.settings.recurringEnabled,
  );

  useEffect(() => {
    if (!recurringEnabled) return;
    const { state, addGeneratedInstances } = useAppStore.getState();
    const current = currentMonthKey();
    const months = [current, monthOffset(current, -1)];
    for (const rule of state.recurrenceRules) {
      for (const month of months) {
        addGeneratedInstances(generateInstances(rule, month));
      }
    }
  }, [recurringEnabled]);
}
