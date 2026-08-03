import { describe, expect, it } from "vitest";
import { categoryAccent } from "../accents";

describe("categoryAccent", () => {
  it("maps keyword groups to their palette", () => {
    expect(categoryAccent("Entertainment").chip).toContain("purple");
    expect(categoryAccent("Food").chip).toContain("green");
    expect(categoryAccent("Transport").chip).toContain("blue");
    expect(categoryAccent("Housing").chip).toContain("orange");
    expect(categoryAccent("Utilities").chip).toContain("yellow");
    expect(categoryAccent("Health").chip).toContain("red");
    expect(categoryAccent("Shopping").chip).toContain("pink");
  });

  it("matches case-insensitively and by substring", () => {
    expect(categoryAccent("rent and bills").chip).toContain("orange");
    expect(categoryAccent("groceries").chip).toContain("green");
  });

  it("falls back to a neutral accent", () => {
    const accent = categoryAccent("Salary");
    expect(accent.chip).toContain("bg-canvas");
    expect(accent.dot).toBe("bg-border");
  });
});
