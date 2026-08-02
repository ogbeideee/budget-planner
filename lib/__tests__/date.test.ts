import { describe, expect, it } from "vitest";
import {
  clampDay,
  currentMonthKey,
  datesInMonthByWeekday,
  dateToIso,
  formatDateShort,
  formatMonthLabel,
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
