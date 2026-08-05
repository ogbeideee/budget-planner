import { describe, expect, it } from "vitest";
import { compactMoney, formatMoney, isMinorUnitsValid, toMinorUnits } from "../money";

describe("toMinorUnits", () => {
  it("parses decimal strings to minor units", () => {
    expect(toMinorUnits("12.5")).toBe(1250);
    expect(toMinorUnits("12.50")).toBe(1250);
    expect(toMinorUnits("0")).toBe(0);
    expect(toMinorUnits("0.01")).toBe(1);
    expect(toMinorUnits("100")).toBe(10000);
  });

  it("strips either currency symbol (AC-20)", () => {
    expect(toMinorUnits("$12.50")).toBe(1250);
    expect(toMinorUnits(" $ 12.50 ")).toBe(1250);
    expect(toMinorUnits("₦1250.50")).toBe(125050);
    expect(toMinorUnits("₦1,250.50")).toBe(NaN);
  });

  it("rejects invalid input", () => {
    expect(Number.isNaN(toMinorUnits("abc"))).toBe(true);
    expect(Number.isNaN(toMinorUnits("1.234"))).toBe(true);
    expect(Number.isNaN(toMinorUnits("1,000"))).toBe(true);
    expect(Number.isNaN(toMinorUnits(""))).toBe(true);
    expect(Number.isNaN(toMinorUnits("-5"))).toBe(true);
  });
});

describe("isMinorUnitsValid", () => {
  it("requires non-negative integers", () => {
    expect(isMinorUnitsValid(0)).toBe(true);
    expect(isMinorUnitsValid(1250)).toBe(true);
    expect(isMinorUnitsValid(-1)).toBe(false);
    expect(isMinorUnitsValid(1.5)).toBe(false);
    expect(isMinorUnitsValid(NaN)).toBe(false);
  });
});

describe("formatMoney", () => {
  it("always renders two decimals", () => {
    expect(formatMoney(1250, "USD")).toBe("$12.50");
    expect(formatMoney(0, "USD")).toBe("$0.00");
    expect(formatMoney(1, "USD")).toBe("$0.01");
    expect(formatMoney(10000, "USD")).toBe("$100.00");
  });

  it("renders negatives with a leading minus", () => {
    expect(formatMoney(-1234, "USD")).toBe("-$12.34");
  });

  it("groups thousands for both currencies (AC-20)", () => {
    expect(formatMoney(125050, "USD")).toBe("$1,250.50");
    expect(formatMoney(125050, "NGN")).toBe("₦1,250.50");
    expect(formatMoney(123456789, "USD")).toBe("$1,234,567.89");
    expect(formatMoney(5000000000, "NGN")).toBe("₦50,000,000.00");
  });
});

describe("compactMoney", () => {
  it("keeps exact formatting below one thousand", () => {
    expect(compactMoney(1250, "USD")).toBe("$12.50");
    expect(compactMoney(0, "USD")).toBe("$0.00");
  });

  it("compacts thousands with one decimal", () => {
    expect(compactMoney(125050, "USD")).toBe("$1.2K");
    expect(compactMoney(1250000, "NGN")).toBe("₦12.5K");
  });

  it("compacts millions with one decimal", () => {
    expect(compactMoney(125000000, "USD")).toBe("$1.2M");
    expect(compactMoney(5000000000, "NGN")).toBe("₦50.0M");
  });

  it("handles negatives", () => {
    expect(compactMoney(-125050, "USD")).toBe("-$1.2K");
  });
});
