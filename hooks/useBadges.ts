"use client";

import { useEffect } from "react";
import { currentMonthKey } from "@/lib/date";
import { newlyEarnedBadges, streakStats } from "@/lib/streak";
import { useAppStore } from "@/store/useAppStore";

/**
 * Records any badge the ledger now qualifies for (FR-21).
 *
 * Runs once at mount from `AppShell`, mirroring `useRollover`. That cadence is
 * right rather than merely convenient: the streak only ever counts COMPLETED
 * months, so it cannot change part-way through a session — there is nothing
 * for a live subscription to catch.
 *
 * `newlyEarnedBadges` returns only ids not already held and `grantBadges`
 * filters again on write, so running this on every launch is free and can
 * never duplicate or re-grant an achievement.
 */
export function useBadges(): void {
  useEffect(() => {
    const { state, grantBadges } = useAppStore.getState();
    grantBadges(
      newlyEarnedBadges(
        streakStats(
          state.budgets,
          state.transactions,
          currentMonthKey(),
          state.rollovers,
        ),
        state.badges,
      ),
    );
  }, []);
}
