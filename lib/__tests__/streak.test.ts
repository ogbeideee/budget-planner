import { describe, expect, it } from "vitest";
import {
  BADGES,
  criteriaMet,
  evaluateBadges,
  formatStreak,
  monthStatus,
  newlyEarnedBadges,
  streakStats,
} from "../streak";
import { ICON_GROUPS } from "@/components/settings/iconLibrary";
import type { Budget, EarnedBadge, Transaction } from "../types";

/** "today" for every test; the streak only ever counts months before it. */
const TODAY = "2026-06";
const LIMIT = 100000;

function budget(month: string, limit = LIMIT): Budget {
  return { id: `b-${month}`, categoryId: "c1", month, limit, priority: "medium" };
}

function spend(month: string, amount: number): Transaction {
  return {
    id: `t-${month}-${amount}`,
    categoryId: "c1",
    amount,
    type: "expense",
    date: `${month}-10`,
    createdAt: "2026-01-10T00:00:00.000Z",
  };
}

/**
 * Builds a ledger from a month->spend map. A month present in the map gets a
 * budget; a month absent gets none at all (the "no data" case).
 */
function ledger(spendByMonth: Record<string, number>) {
  const budgets = Object.keys(spendByMonth).map((month) => budget(month));
  const transactions = Object.entries(spendByMonth)
    .filter(([, amount]) => amount > 0)
    .map(([month, amount]) => spend(month, amount));
  return { budgets, transactions };
}

describe("a single month's status", () => {
  it("is on track when total spending is at or under total budget", () => {
    const { budgets, transactions } = ledger({ "2026-05": 90000 });
    expect(monthStatus(budgets, transactions, "2026-05")).toBe("on-track");
  });

  it("counts spending exactly at the limit as on track", () => {
    const { budgets, transactions } = ledger({ "2026-05": LIMIT });
    expect(monthStatus(budgets, transactions, "2026-05")).toBe("on-track");
  });

  it("is over as soon as spending passes the limit by a penny", () => {
    const { budgets, transactions } = ledger({ "2026-05": LIMIT + 1 });
    // Deliberately checks a penny: the rounded `pct` would still read 100.
    expect(monthStatus(budgets, transactions, "2026-05")).toBe("over");
  });

  it("reports no-data for a month with no budgets at all", () => {
    const { budgets, transactions } = ledger({ "2026-05": 10000 });
    expect(monthStatus(budgets, transactions, "2026-04")).toBe("no-data");
  });

  it("reports no-data rather than on-track for an empty ledger", () => {
    expect(monthStatus([], [], "2026-05")).toBe("no-data");
  });
});

describe("the streak count", () => {
  it("increments across consecutive qualifying months", () => {
    const { budgets, transactions } = ledger({
      "2026-03": 50000,
      "2026-04": 60000,
      "2026-05": 70000,
    });
    expect(streakStats(budgets, transactions, TODAY).current).toBe(3);
  });

  it("resets to 0 when the most recent complete month goes over", () => {
    const { budgets, transactions } = ledger({
      "2026-03": 50000,
      "2026-04": 60000,
      "2026-05": LIMIT * 2, // blew it last month
    });
    expect(streakStats(budgets, transactions, TODAY).current).toBe(0);
  });

  it("counts only the run since the last failure", () => {
    const { budgets, transactions } = ledger({
      "2026-01": 50000,
      "2026-02": LIMIT * 2, // broke here
      "2026-03": 50000,
      "2026-04": 60000,
      "2026-05": 70000,
    });
    const stats = streakStats(budgets, transactions, TODAY);
    expect(stats.current).toBe(3);
    // The earlier good month still counts toward the lifetime total.
    expect(stats.onTrackMonths).toBe(4);
  });

  it("does not let a month with no data extend the streak", () => {
    const { budgets, transactions } = ledger({
      "2026-03": 50000,
      // 2026-04 has no budget at all — nothing to fail, and nothing earned.
      "2026-05": 70000,
    });
    // Only May counts; April breaks the run rather than being skipped over.
    expect(streakStats(budgets, transactions, TODAY).current).toBe(1);
  });

  it("is 0 for a ledger with no data whatsoever", () => {
    expect(streakStats([], [], TODAY).current).toBe(0);
  });

  it("ignores the month in progress, however good or bad it looks", () => {
    const spotless = ledger({ "2026-06": 0 });
    // June is `TODAY` and incomplete — it must not hand out a free +1.
    expect(streakStats(spotless.budgets, spotless.transactions, TODAY).current).toBe(0);

    const blown = ledger({ "2026-05": 50000, "2026-06": LIMIT * 5 });
    // ...nor break a streak that is still only part-way through the month.
    expect(streakStats(blown.budgets, blown.transactions, TODAY).current).toBe(1);
  });

  it("gives a brand-new user with only the current month a streak of 0", () => {
    const { budgets, transactions } = ledger({ "2026-06": 10000 });
    const stats = streakStats(budgets, transactions, TODAY);
    expect(stats.current).toBe(0);
    expect(stats.onTrackMonths).toBe(0);
  });

  it("remembers the longest run even after a reset", () => {
    const { budgets, transactions } = ledger({
      "2026-01": 10000,
      "2026-02": 10000,
      "2026-03": 10000,
      "2026-04": LIMIT * 2, // reset
      "2026-05": 10000,
    });
    const stats = streakStats(budgets, transactions, TODAY);
    expect(stats.current).toBe(1);
    expect(stats.longest).toBe(3);
  });
});

describe("badge definitions", () => {
  it("carries everything the shared evaluator needs", () => {
    for (const badge of BADGES) {
      expect(badge.id).toBeTruthy();
      expect(badge.name).toBeTruthy();
      expect(badge.description).toBeTruthy();
      expect(badge.icon).toBeTruthy();
      expect(badge.tier).toBeGreaterThan(0);
      expect(badge.criteria).toBeTruthy();
    }
  });

  it("uses ids that are unique", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });

  it("uses icons that exist in the shared icon library", () => {
    const available = new Set(
      ICON_GROUPS.flatMap((group) => group.icons).map((icon) => icon.emoji),
    );
    for (const badge of BADGES) {
      expect(available.has(badge.icon)).toBe(true);
    }
  });

  it("leaves `reward` null on every badge — nothing grants perks yet", () => {
    for (const badge of BADGES) {
      expect(badge.reward).toBeNull();
    }
  });
});

describe("badge evaluation", () => {
  const statsWith = (longest: number, onTrackMonths = longest) => ({
    current: longest,
    longest,
    onTrackMonths,
    lastCompleteMonth: "2026-05",
  });

  it("grants a badge once its criteria are met", () => {
    expect(criteriaMet({ kind: "streak-months", months: 3 }, statsWith(3))).toBe(true);
    expect(criteriaMet({ kind: "streak-months", months: 3 }, statsWith(2))).toBe(false);
    expect(criteriaMet({ kind: "first-on-track-month" }, statsWith(0, 1))).toBe(true);
    expect(criteriaMet({ kind: "first-on-track-month" }, statsWith(0, 0))).toBe(false);
  });

  it("returns every badge, locked ones included, with what is needed", () => {
    const rows = evaluateBadges(statsWith(3));
    expect(rows).toHaveLength(BADGES.length);

    const twelve = rows.find((r) => r.badge.id === "streak-12")!;
    expect(twelve.earned).toBe(false);
    expect(twelve.current).toBe(3);
    expect(twelve.target).toBe(12);
    expect(twelve.requirement).toMatch(/12 months in a row/);
  });

  it("orders badges by tier so the ladder reads in order", () => {
    const tiers = evaluateBadges(statsWith(0)).map((r) => r.badge.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it("keeps a badge earned even after the streak resets", () => {
    const held: EarnedBadge[] = [
      { id: "streak-3", earnedAt: "2026-04-01T00:00:00.000Z", value: 3 },
    ];
    // Current run is 0 and the longest is only 1 — but it was genuinely earned.
    const rows = evaluateBadges(
      { current: 0, longest: 1, onTrackMonths: 4, lastCompleteMonth: "2026-05" },
      held,
    );
    const three = rows.find((r) => r.badge.id === "streak-3")!;
    expect(three.earned).toBe(true);
    expect(three.earnedAt).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("granting badges", () => {
  const NOW = "2026-06-01T00:00:00.000Z";
  const stats = {
    current: 3,
    longest: 3,
    onTrackMonths: 3,
    lastCompleteMonth: "2026-05",
  };

  it("returns the badges just earned", () => {
    const granted = newlyEarnedBadges(stats, [], NOW);
    expect(granted.map((b) => b.id).sort()).toEqual(["first-month", "streak-3"]);
    expect(granted[0].earnedAt).toBe(NOW);
  });

  it("does not re-grant a badge already held", () => {
    const held = newlyEarnedBadges(stats, [], NOW);
    // Same stats, run again on a later launch: nothing new.
    expect(newlyEarnedBadges(stats, held, NOW)).toEqual([]);
  });

  it("stays empty across repeated qualifying months once held", () => {
    let held: EarnedBadge[] = newlyEarnedBadges(stats, [], NOW);
    for (const longest of [4, 5]) {
      const later = { ...stats, current: longest, longest, onTrackMonths: longest };
      const fresh = newlyEarnedBadges(later, held, NOW);
      // 4 and 5 months cross no new threshold, so nothing is granted.
      expect(fresh).toEqual([]);
      held = [...held, ...fresh];
    }
    expect(held).toHaveLength(2);
  });

  it("grants only the newly crossed tier when the streak grows", () => {
    let held: EarnedBadge[] = newlyEarnedBadges(stats, [], NOW);
    const atSix = { current: 6, longest: 6, onTrackMonths: 6, lastCompleteMonth: "2026-05" };
    const fresh = newlyEarnedBadges(atSix, held, NOW);
    expect(fresh.map((b) => b.id)).toEqual(["streak-6"]);
    held = [...held, ...fresh];
    expect(newlyEarnedBadges(atSix, held, NOW)).toEqual([]);
  });

  it("grants nothing at all to a user with no qualifying months", () => {
    const none = { current: 0, longest: 0, onTrackMonths: 0, lastCompleteMonth: "2026-05" };
    expect(newlyEarnedBadges(none, [], NOW)).toEqual([]);
  });
});

describe("formatting", () => {
  it("reads naturally at one and many months", () => {
    expect(formatStreak(1)).toBe("1-month streak");
    expect(formatStreak(7)).toBe("7-month streak");
  });

  it("is empty at zero, so callers render nothing", () => {
    expect(formatStreak(0)).toBe("");
  });
});
