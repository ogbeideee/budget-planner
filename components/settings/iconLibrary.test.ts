import { describe, expect, it } from "vitest";
import { ICON_GROUPS, VECTOR_ICON_COMPONENTS, isVectorIcon } from "./iconLibrary";

const emojiGroups = ICON_GROUPS.filter((g) => g.id !== "vectors");
const emojiIcons = emojiGroups.flatMap((g) => g.icons);

/** Every value a category can be assigned, for coverage checks. */
const values = new Set(emojiIcons.map((i) => i.emoji));

/** Search runs over label + keywords, so coverage means "findable by typing". */
function findable(term: string): boolean {
  const q = term.toLowerCase();
  return emojiIcons.some(
    (i) =>
      i.label.toLowerCase().includes(q) ||
      (i.keywords ?? []).some((k) => k.toLowerCase().includes(q)),
  );
}

describe("icon library shape", () => {
  it("keeps every icon value unique across all groups", () => {
    const all = ICON_GROUPS.flatMap((g) => g.icons).map((i) => i.emoji);
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives every option a label and at least one keyword to search on", () => {
    for (const icon of ICON_GROUPS.flatMap((g) => g.icons)) {
      expect(icon.label.trim().length).toBeGreaterThan(0);
      expect((icon.keywords ?? []).length).toBeGreaterThan(0);
    }
  });

  it("keeps vector options resolvable to a real component", () => {
    const vectors = ICON_GROUPS.find((g) => g.id === "vectors");
    for (const icon of vectors?.icons ?? []) {
      expect(icon.kind).toBe("vector");
      expect(isVectorIcon(icon.emoji)).toBe(true);
      expect(VECTOR_ICON_COMPONENTS[icon.emoji]).toBeTypeOf("function");
    }
  });

  it("keeps category-selectable options emoji, never vector keys", () => {
    for (const icon of emojiIcons) {
      // Categories render their icon as raw text in chart axes and <option>s,
      // so a vector key would print as the literal string "wallet" there.
      expect(isVectorIcon(icon.emoji)).toBe(false);
      expect(icon.kind).not.toBe("vector");
    }
  });
});

describe("icon library covers the common budget category types", () => {
  // One entry per category type the picker must be able to serve.
  const REQUIRED = [
    "groceries", "dining out", "rent", "utilities", "electricity", "water",
    "internet", "airtime", "transport", "fuel", "loan", "debt", "savings",
    "streaming", "health", "insurance", "education", "gym", "shopping",
    "travel", "gift", "pets", "kids", "beauty", "charity", "transfer",
    "miscellaneous",
  ];

  it.each(REQUIRED)("can find an icon for %s", (term) => {
    expect(findable(term)).toBe(true);
  });

  it("includes the icons the category audits assigned", () => {
    // Every icon a migration writes must be pickable, or the category ends up
    // carrying a value the picker cannot show as selected.
    for (const assigned of ["📶", "🧺", "💸", "📦", "🌐"]) {
      expect(values.has(assigned)).toBe(true);
    }
  });

  it("groups the options rather than presenting one flat list", () => {
    expect(emojiGroups.length).toBeGreaterThanOrEqual(8);
    for (const group of emojiGroups) {
      expect(group.icons.length).toBeGreaterThan(0);
      expect(group.label.trim().length).toBeGreaterThan(0);
    }
  });
});
