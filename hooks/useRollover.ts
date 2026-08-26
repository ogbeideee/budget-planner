"use client";

import { useEffect } from "react";
import { currentMonthKey } from "@/lib/date";
import { computeRollovers } from "@/lib/rollover";
import { useAppStore } from "@/store/useAppStore";

/**
 * Settles last month's unspent funds into this month, once.
 *
 * There is no backend and no scheduler here, so "the month rolled over" is
 * detected the only way a local-first app can: on open, by noticing this month
 * has no carryover records yet. That check is the transition detector AND the
 * idempotency guard, which is why no separate "last opened month" marker is
 * stored — a marker could drift out of sync with the records it is supposed to
 * describe, whereas the records cannot disagree with themselves.
 *
 * Runs at mount only, like `useRecurring`. An app left open across midnight on
 * the 1st settles on its next launch, which is soon enough for a monthly
 * boundary and avoids a timer that would have to survive sleep and clock
 * changes to be trustworthy.
 */
export function useRollover(): void {
  useEffect(() => {
    const { state, applyRollovers } = useAppStore.getState();
    applyRollovers(
      computeRollovers({
        budgets: state.budgets,
        categories: state.categories,
        transactions: state.transactions,
        rollovers: state.rollovers,
        month: currentMonthKey(),
      }),
    );
  }, []);
}
