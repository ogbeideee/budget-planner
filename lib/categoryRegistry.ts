// THE single source of truth for how a category is displayed.
//
// Before this module the three display facets lived in three different places
// and drifted independently:
//   name  -> capitalized ad hoc per component (the "internet" bug, twice)
//   icon  -> read raw off the record, with a different fallback in each caller
//            ("💸" here, "•" there, nothing elsewhere)
//   color -> THREE parallel systems (categoryColor / categoryAccent /
//            budgetRowTreatment), any of which a component could pick from
//
// Every component that renders a category name, icon or color now calls
// `categoryDisplay` (or `findCategoryDisplay`) and applies only presentational
// overrides — size, opacity, layout — on top of what it returns.
//
// It is derived, never a hardcoded table: a user-created category resolves
// exactly like a seeded one, so nothing has to be registered at creation time.
import {
  budgetRowTreatment,
  categoryAccent,
  categoryColor,
  CATEGORY_COLOR_FALLBACK,
} from "./accents";
import { categoryLabelOr } from "./categoryDisplay";
import type { Category, ID } from "./types";

/** Shown when a category is missing or carries no icon. */
export const FALLBACK_ICON = "•";

/** Shown when a category cannot be resolved at all. */
export const FALLBACK_NAME = "Uncategorized";

/**
 * The registry only reads these fields, so it accepts any category-shaped
 * record — including the trimmed shapes the statement importer builds before a
 * category is persisted.
 */
export type CategoryLike = Pick<Category, "name" | "icon"> &
  Partial<Pick<Category, "id" | "color">>;

export interface CategoryDisplay {
  /** The stored id, or null when the category could not be resolved. */
  id: ID | null;
  /** Canonical display name — capitalized once, here. */
  name: string;
  /** The category's icon, or the shared fallback glyph. */
  icon: string;
  /** The category's colour as a hex string, for charts and inline styles. */
  color: string;
  /** Tailwind classes for a tinted icon tile (background + text). */
  chip: string;
  /** Very subtle row-background tint (rgba/hex8). */
  tint: string;
  /** Stronger accent for progress bars and percentages. */
  strong: string;
  /** True when the category was not found — callers may render differently. */
  missing: boolean;
}

/**
 * Resolve one category to everything needed to display it.
 *
 * `fallbackName` lets a caller keep its own wording for the missing case
 * ("Category", "Expense", "Uncategorized"); the icon and colours always fall
 * back to the shared neutral treatment so they can never diverge.
 */
export function categoryDisplay(
  category: CategoryLike | undefined | null,
  fallbackName: string = FALLBACK_NAME,
): CategoryDisplay {
  if (!category) {
    return {
      id: null,
      name: fallbackName,
      icon: FALLBACK_ICON,
      color: CATEGORY_COLOR_FALLBACK,
      chip: "bg-canvas text-muted",
      tint: "transparent",
      strong: "var(--color-brand-500)",
      missing: true,
    };
  }
  const treatment = budgetRowTreatment(category);
  return {
    id: category.id ?? null,
    name: categoryLabelOr(category.name, fallbackName),
    icon: category.icon?.trim() ? category.icon : FALLBACK_ICON,
    color: categoryColor(category),
    chip: categoryAccent(category.name).chip,
    tint: treatment.tint,
    strong: treatment.strong,
    missing: false,
  };
}

/** `categoryDisplay` for callers that hold an id rather than the record. */
export function findCategoryDisplay(
  categories: Category[],
  categoryId: ID | undefined | null,
  fallbackName?: string,
): CategoryDisplay {
  const category = categoryId
    ? categories.find((entry) => entry.id === categoryId)
    : undefined;
  return categoryDisplay(category, fallbackName);
}
