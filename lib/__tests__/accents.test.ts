import { describe, expect, it } from "vitest";
import { categoryAccent, categoryColor, CATEGORY_COLOR_FALLBACK } from "../accents";

describe("categoryAccent", () => {
  it("maps keyword groups to their palette", () => {
    expect(categoryAccent("Entertainment").chip).toContain("purple");
    expect(categoryAccent("Food").chip).toContain("green");
    expect(categoryAccent("Transport").chip).toContain("yellow");
    expect(categoryAccent("Housing").chip).toContain("blue");
    expect(categoryAccent("Utilities").chip).toContain("amber");
    expect(categoryAccent("Health").chip).toContain("red");
    expect(categoryAccent("Shopping").chip).toContain("orange");
    expect(categoryAccent("Subscriptions").chip).toContain("cyan");
    expect(categoryAccent("Loan").chip).toContain("violet");
  });

  it("matches case-insensitively and by substring", () => {
    expect(categoryAccent("rent and bills").chip).toContain("blue");
    expect(categoryAccent("groceries").chip).toContain("green");
    expect(categoryAccent("netflix").chip).toContain("cyan");
    expect(categoryAccent("credit card").chip).toContain("violet");
  });

  it("falls back to a neutral accent", () => {
    const accent = categoryAccent("Salary");
    expect(accent.chip).toContain("bg-canvas");
    expect(accent.dot).toBe("bg-border");
  });
});

describe("categoryColor", () => {
  it("returns the category color when present", () => {
    expect(categoryColor({ color: "#ef4444" })).toBe("#ef4444");
  });

  it("returns the shared fallback for unknown categories", () => {
    expect(categoryColor(undefined)).toBe(CATEGORY_COLOR_FALLBACK);
    expect(categoryColor(null)).toBe(CATEGORY_COLOR_FALLBACK);
    expect(categoryColor({})).toBe(CATEGORY_COLOR_FALLBACK);
  });
});
