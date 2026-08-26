// Display-only formatting for category names.
//
// Category names are user data and are also the key several presentation maps
// look up (`categoryAccent`, `budgetRowTreatment` — both lowercase internally),
// so the stored value is never rewritten. Instead every place that PRINTS a
// category name runs it through `categoryLabel`, which capitalizes the first
// letter — so a category stored as "internet" reads "Internet" everywhere
// without touching the record or breaking any lookup.
//
// Only the first character is touched: names that are already capitalized,
// multi-word, or intentionally cased ("PalmPay", "iCloud") are left alone.

export function categoryLabel(name: string | undefined | null): string {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** `categoryLabel` with the usual placeholder when the category is missing. */
export function categoryLabelOr(
  name: string | undefined | null,
  fallback: string,
): string {
  const label = categoryLabel(name);
  return label === "" ? fallback : label;
}
