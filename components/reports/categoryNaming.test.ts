import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard against the capitalization bug recurring. It has surfaced twice now:
 * once across the Planner, then again in Category analysis — each time because
 * a component printed `category.name` straight from the store instead of going
 * through `categoryLabel`. This scans component sources for that pattern so the
 * next one fails here rather than in the UI.
 *
 * Sorting, lookups and form drafts legitimately read the raw value, so those
 * shapes are excluded by rule rather than allowlisted per file.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") ? [full] : [];
  });
}

/** Raw reads that are correct: comparisons, lookups, drafts, accent keys. */
const ALLOWED: RegExp[] = [
  /localeCompare/,
  /categoryAccent\(/,
  /budgetRowTreatment\(/,
  /name: category\.name/,
  /categories\.find\(/,
  /\.name ===/,
];

/** A category name being rendered or interpolated into display text. */
const SUSPICIOUS: RegExp[] = [
  /\{ ?category\??\.name/,
  /\$\{category\??\.name/,
  /row\.category!?\.name/,
  /entry\.category\??\.name/,
];

describe("category names always render through the shared formatter", () => {
  it("finds no component printing a raw category name", () => {
    const root = join(process.cwd(), "components");
    const offenders: string[] = [];

    for (const file of walk(root)) {
      const rel = file.slice(root.length + 1).split("\\").join("/");
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (!SUSPICIOUS.some((re) => re.test(line))) return;
          if (line.includes("categoryLabel")) return;
          if (ALLOWED.some((re) => re.test(line))) return;
          offenders.push(`components/${rel}:${index + 1}  ${line.trim()}`);
        });
    }

    expect(
      offenders,
      [
        "Render these through categoryLabel / categoryLabelOr",
        "(lib/categoryDisplay.ts):",
        ...offenders,
      ].join("\n"),
    ).toEqual([]);
  });
});
