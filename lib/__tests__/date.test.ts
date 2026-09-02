import { describe, expect, it } from "vitest";
import {
  clampDay,
  currentMonthKey,
  datesInMonthByWeekday,
  dateToIso,
  defaultDateForMonth,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatMonthLabel,
  formatTime,
  isFutureMonth,
  isIsoDate,
  isMonth,
  isoToDate,
  monthKey,
  monthKeyFromIso,
  monthOffset,
  nextMonthDate,
  parseMonth,
  todayIso,
} from "../date";

describe("monthKey", () => {
  it("zero-pads month keys", () => {
    expect(monthKey(2026, 7)).toBe("2026-08");
    expect(monthKey(2026, 0)).toBe("2026-01");
  });

  it("round-trips through parseMonth", () => {
    expect(monthKey(2026, 7)).toBe(monthKeyFromIso("2026-08-15"));
    const { year, monthIndex } = parseMonth("2026-08");
    expect(monthKey(year, monthIndex)).toBe("2026-08");
  });
});

describe("isMonth / isIsoDate", () => {
  it("accepts valid keys", () => {
    expect(isMonth("2026-08")).toBe(true);
    expect(isIsoDate("2026-08-03")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-8")).toBe(false);
    expect(isMonth("08-2026")).toBe(false);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-08-3")).toBe(false);
  });
});

describe("monthOffset", () => {
  it("shifts months across year boundaries", () => {
    expect(monthOffset("2026-08", -1)).toBe("2026-07");
    expect(monthOffset("2026-08", 1)).toBe("2026-09");
    expect(monthOffset("2026-01", -1)).toBe("2025-12");
    expect(monthOffset("2026-12", 1)).toBe("2027-01");
  });
});

describe("clampDay", () => {
  it("clamps to the month length (Feb 2026 has 28 days)", () => {
    expect(clampDay(2026, 1, 31)).toBe(28);
    expect(clampDay(2026, 0, 31)).toBe(31);
    expect(clampDay(2026, 1, 15)).toBe(15);
  });
});

describe("nextMonthDate (AC-17)", () => {
  it("moves to the same day in the next month", () => {
    expect(nextMonthDate("2026-08-15")).toBe("2026-09-15");
    expect(nextMonthDate("2026-12-31")).toBe("2027-01-31");
  });

  it("clamps the day to the target month length", () => {
    expect(nextMonthDate("2026-01-31")).toBe("2026-02-28");
    expect(nextMonthDate("2028-01-31")).toBe("2028-02-29");
  });
});

describe("datesInMonthByWeekday", () => {
  it("enumerates Mondays in August 2026", () => {
    const mondays = datesInMonthByWeekday("2026-08", 1);
    expect(mondays.map(dateToIso)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });
});

describe("date helpers", () => {
  it("round-trips iso dates", () => {
    expect(dateToIso(isoToDate("2026-08-03"))).toBe("2026-08-03");
    expect(monthKeyFromIso("2026-08-03")).toBe("2026-08");
  });

  it("formats labels", () => {
    expect(formatMonthLabel("2026-08")).toBe("August 2026");
    expect(formatDateShort("2026-08-03")).toBe("Aug 3");
  });

  it("produces valid today/current month", () => {
    expect(isIsoDate(todayIso())).toBe(true);
    expect(isMonth(currentMonthKey())).toBe(true);
  });
});

describe("formatTime / formatDateTime", () => {
  it("formats a local time of day from an ISO datetime", () => {
    const iso = new Date(2026, 7, 15, 9, 5).toISOString();
    expect(formatTime(iso)).toBe("9:05 AM");

    const midnight = new Date(2026, 7, 15, 0, 0).toISOString();
    expect(formatTime(midnight)).toBe("12:00 AM");

    const afternoon = new Date(2026, 7, 15, 16, 45).toISOString();
    expect(formatTime(afternoon)).toBe("4:45 PM");
  });

  it("falls back to an empty string for missing or invalid values", () => {
    expect(formatTime("")).toBe("");
    expect(formatTime("not-a-date")).toBe("");
    expect(formatTime("garbage")).toBe("");
  });

  it("combines a short date with the time of day", () => {
    const iso = new Date(2026, 7, 15, 9, 5).toISOString();
    expect(formatDateTime(iso)).toBe("Aug 15, 2026 · 9:05 AM");
    expect(formatDateTime("")).toBe("");
  });
});

describe("formatDateLong", () => {
  it("formats a full weekday, month, day and year", () => {
    expect(formatDateLong("2026-08-15")).toBe("Saturday, August 15, 2026");
  });
});

describe("defaultDateForMonth", () => {
  it("uses today when today falls inside the viewed month", () => {
    const month = monthKeyFromIso(todayIso());
    expect(defaultDateForMonth(month)).toBe(todayIso());
  });

  it("defaults to the first of the month for past months", () => {
    const past = monthOffset(monthKeyFromIso(todayIso()), -1);
    expect(defaultDateForMonth(past)).toBe(`${past}-01`);
    expect(monthKeyFromIso(defaultDateForMonth(past))).toBe(past);
  });

  it("defaults to the first of the month for future months", () => {
    const future = monthOffset(monthKeyFromIso(todayIso()), 1);
    expect(defaultDateForMonth(future)).toBe(`${future}-01`);
    expect(monthKeyFromIso(defaultDateForMonth(future))).toBe(future);
  });

  it("always stays inside the viewed month's boundaries", () => {
    for (const delta of [-3, -1, 0, 1, 3]) {
      const month = monthOffset(monthKeyFromIso(todayIso()), delta);
      const date = defaultDateForMonth(month);
      expect(monthKeyFromIso(date)).toBe(month);
      expect(isIsoDate(date)).toBe(true);
    }
  });
});

describe("isFutureMonth (FR-27)", () => {
  it("is true only for months after the current one", () => {
    const current = currentMonthKey();
    expect(isFutureMonth(monthOffset(current, 1))).toBe(true);
    expect(isFutureMonth(monthOffset(current, 12))).toBe(true);
    expect(isFutureMonth(current)).toBe(false);
    expect(isFutureMonth(monthOffset(current, -1))).toBe(false);
  });

  it("rejects invalid month keys", () => {
    expect(isFutureMonth("2099-13")).toBe(false);
    expect(isFutureMonth("not-a-month")).toBe(false);
  });
});
