import { describe, expect, it } from "vitest";
import {
  daysUntilLabel,
  filterUpcoming,
  groupFutureExpenses,
  groupLabel,
  sortedPaidExpenses,
  upcomingSummary,
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
    expect(groupLabel("2026-08-07", TODAY)).toBe("This week");
    expect(groupLabel("2026-08-10", TODAY)).toBe("Next week");
    expect(groupLabel("2026-08-13", TODAY)).toBe("Next week");
    expect(groupLabel("2026-08-17", TODAY)).toBe("Later");
    expect(groupLabel("2026-09-01", TODAY)).toBe("Later");
    expect(groupLabel("2026-12-01", TODAY)).toBe("Later");
  });

  it("groups the rest of the current week together", () => {
    expect(groupLabel("2026-08-09", TODAY)).toBe("This week");
    expect(groupLabel("2026-08-14", TODAY)).toBe("Next week");
  });
});

describe("daysUntilLabel", () => {
  it("labels the countdown in days", () => {
    expect(daysUntilLabel("2026-08-02", TODAY)).toBe("1 day overdue");
    expect(daysUntilLabel("2026-08-01", TODAY)).toBe("2 days overdue");
    expect(daysUntilLabel("2026-08-03", TODAY)).toBe("due today");
    expect(daysUntilLabel("2026-08-04", TODAY)).toBe("tomorrow");
    expect(daysUntilLabel("2026-08-06", TODAY)).toBe("in 3 days");
    expect(daysUntilLabel("2026-08-10", TODAY)).toBe("in 7 days");
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
      "This week",
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

describe("upcomingSummary", () => {
  it("totals upcoming, nearest, this-month and recurring figures", () => {
    const summary = upcomingSummary(
      [
        expense("a", "2026-08-05"),
        { ...expense("b", "2026-08-20"), amount: 2500 },
        { ...expense("c", "2026-09-01"), amount: 3000, recurring: true },
        expense("paid", "2026-08-05", "paid"),
      ],
      TODAY,
    );
    expect(summary.total).toBe(6500);
    expect(summary.count).toBe(3);
    expect(summary.next?.id).toBe("a");
    expect(summary.next?.amount).toBe(1000);
    expect(summary.thisMonthTotal).toBe(3500);
    expect(summary.thisMonthCount).toBe(2);
    expect(summary.recurringCount).toBe(1);
  });

  it("picks the soonest due date as next regardless of array order", () => {
    const summary = upcomingSummary(
      [
        expense("later", "2026-09-15"),
        expense("soon", "2026-08-06"),
        expense("today", "2026-08-03"),
      ],
      TODAY,
    );
    expect(summary.next?.id).toBe("today");
  });

  it("reports no next when nothing is upcoming", () => {
    const summary = upcomingSummary(
      [expense("paid", "2026-08-05", "paid")],
      TODAY,
    );
    expect(summary.next).toBeNull();
    expect(summary.total).toBe(0);
    expect(summary.count).toBe(0);
    expect(summary.thisMonthTotal).toBe(0);
    expect(summary.recurringCount).toBe(0);
  });
});

describe("filterUpcoming", () => {
  const all = [
    expense("overdue-last-month", "2026-07-20"),
    expense("this-month", "2026-08-20"),
    expense("later", "2026-09-01"),
    expense("paid-this-month", "2026-08-10", "paid"),
  ];

  it("keeps every upcoming expense for the All filter", () => {
    expect(filterUpcoming(all, "all", TODAY).map((item) => item.id)).toEqual([
      "overdue-last-month",
      "this-month",
      "later",
    ]);
  });

  it("keeps only expenses due inside the current month", () => {
    expect(filterUpcoming(all, "month", TODAY).map((item) => item.id)).toEqual([
      "this-month",
    ]);
  });

  it("keeps only expenses due after the current month", () => {
    expect(filterUpcoming(all, "later", TODAY).map((item) => item.id)).toEqual([
      "later",
    ]);
  });
});
