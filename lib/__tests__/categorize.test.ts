import { beforeEach, describe, expect, it } from "vitest";
import { CATEGORIZATION_KEY } from "../storage";
import {
  loadLearnedMappings,
  normalizeTitle,
  rememberMapping,
  suggestCategory,
} from "../categorize";
import type { Category } from "../types";

function makeCategories(names: string[]): Category[] {
  return names.map((name, index) => ({
    id: `cat-${index}`,
    name,
    icon: "•",
    color: "#000000",
    kind: "expense",
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
}

const defaults = makeCategories([
  "Rent",
  "Groceries",
  "Transport",
  "Utilities",
  "Entertainment",
]);

beforeEach(() => {
  window.localStorage.clear();
});

describe("normalizeTitle", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeTitle("  Netflix   Subscription ")).toBe("netflix subscription");
    expect(normalizeTitle("")).toBe("");
  });
});

describe("suggestCategory", () => {
  it("matches a keyword with high confidence when the title starts with it", () => {
    const suggestion = suggestCategory("Netflix subscription", defaults);
    expect(suggestion).not.toBeNull();
    expect(suggestion).toMatchObject({ confidence: "high", keyword: "netflix" });
    expect(suggestion?.categoryId).toBe(
      defaults.find((c) => c.name === "Entertainment")!.id,
    );
  });

  it("returns low confidence for a short mid-title keyword", () => {
    const suggestion = suggestCategory("paying for lunch today", defaults);
    expect(suggestion).not.toBeNull();
    expect(suggestion).toMatchObject({ confidence: "low", keyword: "lunch" });
    expect(suggestion?.categoryId).toBe(
      defaults.find((c) => c.name === "Groceries")!.id,
    );
  });

  it("prefers the longest matching keyword", () => {
    const suggestion = suggestCategory("gas bill payment", defaults);
    expect(suggestion?.keyword).toBe("gas bill");
    expect(suggestion?.categoryId).toBe(
      defaults.find((c) => c.name === "Utilities")!.id,
    );
  });

  it("falls back to a secondary category name (Food → Groceries)", () => {
    const suggestion = suggestCategory("lunch with team", defaults);
    expect(suggestion?.categoryId).toBe(
      defaults.find((c) => c.name === "Groceries")!.id,
    );
    const withFood = makeCategories([...defaults.map((c) => c.name), "Food"]);
    const foodSuggestion = suggestCategory("lunch with team", withFood);
    expect(foodSuggestion?.categoryId).toBe(
      withFood.find((c) => c.name === "Food")!.id,
    );
  });

  it("returns null for unmatched titles", () => {
    expect(suggestCategory("random errand", defaults)).toBeNull();
    expect(suggestCategory("", defaults)).toBeNull();
  });

  it("matches only categories that exist", () => {
    const noEntertainment = makeCategories(["Rent", "Groceries"]);
    expect(suggestCategory("Netflix", noEntertainment)).toBeNull();
  });

  it("ignores income categories when resolving", () => {
    const withIncome = [...defaults, { ...defaults[0], id: "salary", name: "Entertainment", kind: "income" as const }];
    const suggestion = suggestCategory("Netflix", withIncome);
    expect(suggestion?.categoryId).not.toBe("salary");
  });

  it("prefers a learned mapping with high confidence", () => {
    const suggestion = suggestCategory(
      "data bundle topup",
      defaults,
      { "data bundle topup": defaults[0].id },
    );
    expect(suggestion).toEqual({
      categoryId: defaults[0].id,
      confidence: "high",
      keyword: "data bundle topup",
    });
  });
});

describe("learned mappings persistence", () => {
  it("remembers a mapping and persists it", () => {
    rememberMapping("Data bundle", "cat-9");
    const raw = window.localStorage.getItem(CATEGORIZATION_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ "data bundle": "cat-9" });
    expect(loadLearnedMappings()).toEqual({ "data bundle": "cat-9" });
  });

  it("skips empty titles", () => {
    rememberMapping("   ", "cat-9");
    expect(window.localStorage.getItem(CATEGORIZATION_KEY)).toBeNull();
  });

  it("rejects corrupt stored data", () => {
    window.localStorage.setItem(CATEGORIZATION_KEY, "not json");
    expect(loadLearnedMappings()).toEqual({});
  });
});
