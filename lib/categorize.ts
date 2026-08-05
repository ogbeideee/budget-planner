import { CATEGORIZATION_KEY } from "./storage";
import { getStorageBackend } from "./storageAdapter";
import type { Category, ID } from "./types";

const MAX_LEARNED_ENTRIES = 100;

interface KeywordRule {
  keywords: readonly string[];
  names: readonly string[];
}

const KEYWORD_RULES: ReadonlyArray<KeywordRule> = [
  {
    keywords: ["gas bill", "electricity", "power", "water", "internet", "wifi", "broadband", "phone bill", "utility"],
    names: ["Utilities"],
  },
  {
    keywords: ["netflix", "spotify", "disney+", "disney", "cinema", "movie", "movies", "games", "steam", "playstation", "xbox", "youtube", "prime video", "concert", "show", "hulu"],
    names: ["Entertainment"],
  },
  {
    keywords: ["uber", "lyft", "taxi", "fuel", "petrol", "gas", "bus", "metro", "train", "parking", "transport"],
    names: ["Transport"],
  },
  {
    keywords: ["groceries", "grocery", "supermarket", "food", "restaurant", "cafe", "coffee", "lunch", "dinner", "breakfast", "snack", "takeaway", "delivery", "pizza", "burger"],
    names: ["Food", "Groceries"],
  },
  {
    keywords: ["rent", "mortgage", "housing", "landlord"],
    names: ["Housing", "Rent"],
  },
  {
    keywords: ["doctor", "hospital", "pharmacy", "medicine", "medical", "dentist", "gym", "health", "clinic"],
    names: ["Health"],
  },
  {
    keywords: ["shopping", "clothes", "clothing", "shoes", "fashion", "mall", "gift", "electronics", "supermarket"],
    names: ["Shopping"],
  },
];

export interface CategorySuggestion {
  categoryId: ID;
  confidence: "high" | "low";
  keyword: string;
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveCategoryName(names: readonly string[], categories: readonly Category[]): Category | null {
  const byName = (name: string) =>
    categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
  for (const name of names) {
    const category = byName(name);
    if (category) return category;
  }
  return null;
}

export function loadLearnedMappings(): Record<string, ID> {
  if (typeof window === "undefined") return {};
  try {
    const raw = getStorageBackend().getItem(CATEGORIZATION_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const mappings: Record<string, ID> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.length > 0) {
        mappings[key] = value;
      }
    }
    return mappings;
  } catch {
    return {};
  }
}

export function saveLearnedMappings(mappings: Record<string, ID>): void {
  if (typeof window === "undefined") return;
  getStorageBackend().setItem(CATEGORIZATION_KEY, JSON.stringify(mappings));
}

export function rememberMapping(title: string, categoryId: ID): void {
  const key = normalizeTitle(title);
  if (key.length === 0) return;
  const mappings = loadLearnedMappings();
  const next: Record<string, ID> = { ...mappings, [key]: categoryId };
  const entries = Object.entries(next);
  if (entries.length > MAX_LEARNED_ENTRIES) {
    delete next[entries[0][0]];
  }
  saveLearnedMappings(next);
}

export function suggestCategory(
  title: string,
  categories: readonly Category[],
  learned: Record<string, ID> | null = null,
): CategorySuggestion | null {
  const key = normalizeTitle(title);
  if (key.length === 0) return null;

  const mappings = learned ?? loadLearnedMappings();
  const learnedId = mappings[key];
  if (learnedId) {
    return { categoryId: learnedId, confidence: "high", keyword: key };
  }

  let best: { rule: KeywordRule; keyword: string } | null = null;
  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (key.includes(keyword)) {
        if (!best || keyword.length > best.keyword.length) {
          best = { rule, keyword };
        }
      }
    }
  }
  if (!best) return null;

  const category = resolveCategoryName(best.rule.names, categories);
  if (!category) return null;

  const confidence: "high" | "low" =
    key.startsWith(best.keyword) || best.keyword.length >= 6 ? "high" : "low";
  return { categoryId: category.id, confidence, keyword: best.keyword };
}
