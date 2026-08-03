import { describe, expect, it } from "vitest";
import { groupTransactionsByTime, timelineLabel } from "../timeline";
import type { Transaction } from "../types";

const TODAY = "2026-08-03";

function txn(id: string, date: string): Transaction {
  return {
    id,
    categoryId: "c1",
    amount: 100,
    type: "expense",
    date,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("timelineLabel", () => {
  it("labels relative buckets", () => {
    expect(timelineLabel("2026-08-04", TODAY)).toBe("Upcoming");
    expect(timelineLabel("2026-08-03", TODAY)).toBe("Today");
    expect(timelineLabel("2026-08-02", TODAY)).toBe("Yesterday");
    expect(timelineLabel("2026-07-30", TODAY)).toBe("Last week");
    expect(timelineLabel("2026-07-25", TODAY)).toBe("Earlier");
  });
});

describe("groupTransactionsByTime", () => {
  it("groups in chronological order and preserves item order", () => {
    const groups = groupTransactionsByTime(
      [
        txn("old", "2026-07-20"),
        txn("yesterday", "2026-08-02"),
        txn("today", "2026-08-03"),
        txn("last-week", "2026-08-01"),
      ],
      TODAY,
    );
    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Last week",
      "Earlier",
    ]);
    expect(groups[2].items.map((item) => item.id)).toEqual(["last-week"]);
  });

  it("omits empty buckets", () => {
    const groups = groupTransactionsByTime([txn("today", "2026-08-03")], TODAY);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
  });
});
