import { describe, expect, it } from "vitest";
import {
  budgetRowTreatment,
  categoryAccent,
  categoryColor,
  CATEGORY_COLOR_FALLBACK,
} from "../accents";

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

describe("budgetRowTreatment", () => {
  it("gives every budget category its pastel tint and strong accent", () => {
    expect(budgetRowTreatment({ name: "Transport" })).toEqual({
      tint: "rgba(251, 191, 36, 0.09)",
      strong: "#14b8a6",
    });
    expect(budgetRowTreatment({ name: "Loan" })).toEqual({
      tint: "rgba(216, 180, 254, 0.10)",
      strong: "#14b8a6",
    });
    expect(budgetRowTreatment({ name: "Edi" })).toEqual({
      tint: "rgba(252, 165, 165, 0.10)",
      strong: "#ef4444",
    });
    expect(budgetRowTreatment({ name: "Misc" })).toEqual({
      tint: "rgba(148, 163, 184, 0.10)",
      strong: "#6b7280",
    });
    expect(budgetRowTreatment({ name: "Essentials" })).toEqual({
      tint: "rgba(251, 113, 133, 0.08)",
      strong: "#ef4444",
    });
    expect(budgetRowTreatment({ name: "Internet" })).toEqual({
      tint: "rgba(251, 146, 60, 0.10)",
      strong: "#f97316",
    });
    expect(budgetRowTreatment({ name: "PalmPay" })).toEqual({
      tint: "rgba(125, 211, 252, 0.10)",
      strong: "#0ea5e9",
    });
  });

  it("matches case-insensitively", () => {
    expect(budgetRowTreatment({ name: "palmpay" }).strong).toBe("#0ea5e9");
  });

  it("falls back to the stored color tint and theme brand for unknown categories", () => {
    expect(budgetRowTreatment({ name: "Rent", color: "#0d9488" })).toEqual({
      tint: "#0d948812",
      strong: "var(--color-brand-500)",
    });
    expect(budgetRowTreatment(null).strong).toBe("var(--color-brand-500)");
  });
});
