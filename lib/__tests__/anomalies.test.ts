import { describe, expect, it } from "vitest";
import {
  ANOMALY_MIN_PRIOR_ENTRIES,
  ANOMALY_RATIO_THRESHOLD,
  ANOMALY_WINDOW_MONTHS,
  checkAnomaly,
  categoryRecentAverage,
} from "../anomalies";
import type { Transaction } from "../types";

const TODAY = "2026-08-27";
const CAT = "c1";
const OTHER = "c2";

let seq = 0;
function tx(
  categoryId: string,
  amount: number,
  date: string,
  extra: Partial<Transaction> = {},
): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    categoryId,
    amount,
    type: "expense",
    date,
    createdAt: `${date}T00:00:00.000Z`,
    ...extra,
  };
}

/** Four priors of 100000 spread through the trailing window. */
function seedHistory(categoryId = CAT) {
  return [
    tx(categoryId, 100000, "2026-08-10"),
    tx(categoryId, 100000, "2026-07-10"),
    tx(categoryId, 100000, "2026-06-10"),
    tx(categoryId, 100000, "2026-05-10"),
  ];
}

describe("categoryRecentAverage", () => {
  it("averages the category's expense entries inside the window", () => {
    const history = seedHistory();
    history.push(tx(OTHER, 999999, "2026-08-01")); // other category ignored
    history.push(tx(CAT, 5555555, "2026-09-15")); // future-dated ignored
    history.push(tx(CAT, 1, "2026-02-01")); // older than 6 months ignored
    expect(categoryRecentAverage(history, CAT, { today: TODAY })).toBe(100000);
  });

  it("returns null for a category with no windowed entries", () => {
    expect(categoryRecentAverage([], CAT, { today: TODAY })).toBeNull();
  });
});

describe("checkAnomaly — flagging rules", () => {
  it("flags an entry at 3x the category average", () => {
    const verdict = checkAnomaly(
      seedHistory(),
      { categoryId: CAT, amount: 300000 },
      { today: TODAY },
    );
    expect(verdict.flagged).toBe(true);
    expect(verdict.priorCount).toBe(4);
    expect(verdict.averageAmount).toBe(100000);
    expect(verdict.ratio).toBe(3);
  });

  it("does NOT flag an entry merely at 2x — the ratio must clear the threshold", () => {
    const verdict = checkAnomaly(
      seedHistory(),
      { categoryId: CAT, amount: 200000 },
      { today: TODAY },
    );
    expect(verdict.flagged).toBe(false);
    expect(verdict.ratio).toBe(2);
  });

  it("does NOT flag a category with insufficient history (fewer than 3 priors)", () => {
    const verdict = checkAnomaly(
      [tx(CAT, 100000, "2026-08-10"), tx(CAT, 100000, "2026-07-10")],
      { categoryId: CAT, amount: 5000000 },
      { today: TODAY },
    );
    expect(verdict.flagged).toBe(false);
    expect(verdict.priorCount).toBe(2);
    expect(verdict.averageAmount).toBeNull();
    expect(verdict.ratio).toBeNull();
  });

  it("does NOT flag amounts below the average — only notably HIGHER is a typo signal", () => {
    const verdict = checkAnomaly(
      seedHistory(),
      { categoryId: CAT, amount: 1000 },
      { today: TODAY },
    );
    expect(verdict.flagged).toBe(false);
  });

  it("ignores priors that fell outside the trailing window entirely", () => {
    // All history is older than ~6 months before TODAY -> no usable average.
    const verdict = checkAnomaly(
      [
        tx(CAT, 100000, "2026-01-10"),
        tx(CAT, 100000, "2026-01-11"),
        tx(CAT, 100000, "2026-01-12"),
        tx(CAT, 100000, "2026-01-13"),
      ],
      { categoryId: CAT, amount: 900000 },
      { today: TODAY },
    );
    expect(verdict.flagged).toBe(false);
  });
});

describe("documented defaults", () => {
  it("uses a 6-month window, 3 prior entries and a strict >2x ratio", () => {
    expect(ANOMALY_WINDOW_MONTHS).toBe(6);
    expect(ANOMALY_MIN_PRIOR_ENTRIES).toBe(3);
    expect(ANOMALY_RATIO_THRESHOLD).toBe(2);
  });
});

