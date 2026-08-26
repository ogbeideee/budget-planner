import { describe, expect, it } from "vitest";
import { categoryLabel, categoryLabelOr } from "../categoryDisplay";

describe("categoryLabel", () => {
  it("capitalizes a lowercase stored name", () => {
    expect(categoryLabel("internet")).toBe("Internet");
  });

  it("leaves an already-capitalized name untouched", () => {
    expect(categoryLabel("Transport")).toBe("Transport");
  });

  it("only touches the first character, preserving intentional casing", () => {
    expect(categoryLabel("PalmPay")).toBe("PalmPay");
    expect(categoryLabel("eBay refunds")).toBe("EBay refunds");
    expect(categoryLabel("rental income")).toBe("Rental income");
  });

  it("handles emoji and non-letter first characters without corrupting them", () => {
    expect(categoryLabel("🏠 rent")).toBe("🏠 rent");
    expect(categoryLabel("2026 goals")).toBe("2026 goals");
  });

  it("returns an empty string for blank input", () => {
    expect(categoryLabel("")).toBe("");
    expect(categoryLabel(undefined)).toBe("");
    expect(categoryLabel(null)).toBe("");
  });
});

describe("categoryLabelOr", () => {
  it("capitalizes when a name is present", () => {
    expect(categoryLabelOr("internet", "Category")).toBe("Internet");
  });

  it("falls back when the category is missing", () => {
    expect(categoryLabelOr(undefined, "Uncategorized")).toBe("Uncategorized");
    expect(categoryLabelOr("", "Category")).toBe("Category");
  });
});
