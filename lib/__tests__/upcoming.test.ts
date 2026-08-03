import { describe, expect, it } from "vitest";
import {
  groupFutureExpenses,
  groupLabel,
  sortedPaidExpenses,
} from "../upcoming";
import type { FutureExpense } from "../types";

const TODAY = "2026-08-03"; // Monday

function expense(
  id: string,
  dueDate: string,
  status: "upcoming" | "paid" = "upcoming",
): FutureExpense {
  return {
    id,
    categoryId: "c1",
    amount: 1000,
    title: id,
    dueDate,
    recurring: false,
    priority: "medium",
    status,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("groupLabel", () => {
  it("labels relative buckets", () => {
    expect(groupLabel("2026-08-02", TODAY)).toBe("Overdue");
    expect(groupLabel("2026-08-03", TODAY)).toBe("Today");
    expect(groupLabel("2026-08-04", TODAY)).toBe("Tomorrow");
    expect(groupLabel("2026-08-07", TODAY)).toBe("Friday");
    expect(groupLabel("2026-08-10", TODAY)).toBe("Next week");
    expect(groupLabel("2026-08-13", TODAY)).toBe("Next week");
    expect(groupLabel("2026-08-17", TODAY)).toBe("Next month");
    expect(groupLabel("2026-09-01", TODAY)).toBe("Next month");
    expect(groupLabel("2026-12-01", TODAY)).toBe("Later");
  });

  it("uses the weekday name only within the same week", () => {
    expect(groupLabel("2026-08-09", TODAY)).toBe("Sunday");
    expect(groupLabel("2026-08-14", TODAY)).toBe("Next week");
  });
});

describe("groupFutureExpenses", () => {
  it("groups by bucket in chronological order", () => {
    const groups = groupFutureExpenses(
      [
        expense("later", "2026-11-01"),
        expense("fri", "2026-08-07"),
        expense("today", "2026-08-03"),
        expense("tomorrow", "2026-08-04"),
      ],
      TODAY,
    );
    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Tomorrow",
      "Friday",
      "Later",
    ]);
    expect(groups[0].items.map((item) => item.id)).toEqual(["today"]);
  });

  it("sorts items within a group by due date", () => {
    const groups = groupFutureExpenses(
      [
        expense("b", "2026-09-15"),
        expense("a", "2026-09-01"),
      ],
      TODAY,
    );
    expect(groups[0].items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("excludes paid expenses", () => {
    const groups = groupFutureExpenses(
      [expense("upcoming", "2026-08-04"), expense("paid", "2026-08-04", "paid")],
      TODAY,
    );
    expect(groups[0].items.map((item) => item.id)).toEqual(["upcoming"]);
  });
});

describe("sortedPaidExpenses", () => {
  it("returns paid expenses newest first", () => {
    const paid = sortedPaidExpenses([
      expense("old", "2026-07-01", "paid"),
      expense("new", "2026-08-01", "paid"),
      expense("upcoming", "2026-08-04"),
    ]);
    expect(paid.map((item) => item.id)).toEqual(["new", "old"]);
  });
});
