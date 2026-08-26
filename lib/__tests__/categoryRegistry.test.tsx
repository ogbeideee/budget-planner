import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createInitialState } from "@/lib/seed";
import { currentMonthKey } from "@/lib/date";
import { categoryDisplay, FALLBACK_ICON } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import type { Budget, Category, Transaction } from "@/lib/types";

import { BudgetRow } from "@/components/planner/BudgetRow";
import { RecentActivity } from "@/components/planner/RecentActivity";
import { CategoryAnalysisChart } from "@/components/reports/CategoryAnalysisChart";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  // CategoryAnalysisChart reads it via useReducedMotion.
  if (typeof window !== "undefined" && !window.matchMedia) {
    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  }
});

afterEach(cleanup);

const MONTH = currentMonthKey();

/** Stored exactly as the two reported bugs describe: lowercase name, and Edi. */
const EDI: Category = {
  id: "cat-edi",
  name: "Edi",
  icon: "📶",
  color: "#ef4444",
  kind: "expense",
  createdAt: new Date().toISOString(),
};
const INTERNET: Category = {
  id: "cat-internet",
  name: "internet", // deliberately lowercase in storage
  icon: "🌐",
  color: "#f97316",
  kind: "expense",
  createdAt: new Date().toISOString(),
};

function seed() {
  const base = createInitialState();
  const budgets: Budget[] = [EDI, INTERNET].map((c, i) => ({
    id: `b-${i}`,
    categoryId: c.id,
    month: MONTH,
    limit: 100000,
    priority: "medium",
  }));
  const transactions: Transaction[] = [EDI, INTERNET].map((c, i) => ({
    id: `t-${i}`,
    type: "expense",
    categoryId: c.id,
    amount: 50000 + i,
    date: `${MONTH}-05`,
    createdAt: new Date().toISOString(),
  }));
  useAppStore.setState({
    state: { ...base, categories: [EDI, INTERNET], budgets, transactions },
  });
  return { budgets, transactions };
}

beforeEach(() => {
  window.localStorage.clear();
  seed();
});

/** Every glyph rendered inside a component, for cross-component comparison. */
function glyphsIn(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("span,div,li"))
    .filter((el) => el.children.length === 0)
    .map((el) => (el.textContent ?? "").trim())
    .filter((t) => /\p{Extended_Pictographic}/u.test(t));
}

describe("registry resolves one category the same way for everyone", () => {
  it("returns name, icon and colour together", () => {
    const d = categoryDisplay(EDI);
    expect(d).toMatchObject({ id: "cat-edi", name: "Edi", icon: "📶", color: "#ef4444" });
    expect(d.chip).toBeTruthy();
    expect(d.missing).toBe(false);
  });

  it("capitalizes a lowercase stored name once, here", () => {
    expect(categoryDisplay(INTERNET).name).toBe("Internet");
  });

  it("falls back consistently instead of per-component guesses", () => {
    const d = categoryDisplay(undefined, "Category");
    expect(d.name).toBe("Category");
    expect(d.icon).toBe(FALLBACK_ICON);
    expect(d.missing).toBe(true);
  });

  it("works for a user-created category with no code change", () => {
    const custom: Category = { ...EDI, id: "user-1", name: "childcare", icon: "🧸" };
    expect(categoryDisplay(custom)).toMatchObject({ name: "Childcare", icon: "🧸" });
  });
});

/**
 * The bug that recurred four times: Edi's icon differing between components.
 * Render the same category in each migrated surface and demand one glyph.
 */
describe("Edi's icon is identical across every migrated component", () => {
  it("BudgetRow, RecentActivity and Category analysis all show 📶", () => {
    const { budgets, transactions } = seed();

    const row = render(
      <BudgetRow
        budget={budgets[0]}
        category={EDI}
        progress={{ limit: 100000, baseLimit: 100000, rolledOver: 0, spent: 50000, remaining: 50000, progress: 0.5, over: false }}
        currency="USD"
        onEdit={vi.fn()}
        onAllocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(glyphsIn(row.container)).toContain("📶");
    cleanup();

    const recent = render(<RecentActivity month={MONTH} />);
    expect(glyphsIn(recent.container)).toContain("📶");
    cleanup();

    const analysis = render(<CategoryAnalysisChart month={MONTH} />);
    expect(glyphsIn(analysis.container)).toContain("📶");

    // And nobody renders a stale tree/plant — the original symptom.
    for (const stale of ["🌲", "🌱", "🌳", "🪴"]) {
      expect(glyphsIn(analysis.container)).not.toContain(stale);
    }
    void transactions;
  });
});

/** The other recurring bug: "internet" rendering lowercase somewhere. */
describe("a lowercase stored name renders capitalized everywhere", () => {
  it("BudgetRow, RecentActivity and Category analysis all show 'Internet'", () => {
    const { budgets } = seed();

    const row = render(
      <BudgetRow
        budget={budgets[1]}
        category={INTERNET}
        progress={{ limit: 100000, baseLimit: 100000, rolledOver: 0, spent: 50000, remaining: 50000, progress: 0.5, over: false }}
        currency="USD"
        onEdit={vi.fn()}
        onAllocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(within(row.container).getByText("Internet")).toBeInTheDocument();
    expect(row.container.textContent).not.toMatch(/(^|\s)internet(\s|$)/);
    cleanup();

    const recent = render(<RecentActivity month={MONTH} />);
    expect(recent.container.textContent).toContain("Internet");
    expect(recent.container.textContent).not.toMatch(/(^|\s)internet(\s|$)/);
    cleanup();

    const analysis = render(<CategoryAnalysisChart month={MONTH} />);
    expect(analysis.container.textContent).toContain("Internet");
    expect(analysis.container.textContent).not.toMatch(/(^|\s)internet(\s|$)/);
  });
});

/**
 * The structural guard: no component may re-derive name, icon or colour on its
 * own. This is what makes a fifth recurrence fail here rather than in the UI.
 */
describe("no component bypasses the registry", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") ? [full] : [];
    });
  }

  // Sorting, lookups and the category form's own draft legitimately read raw.
  const ALLOWED = [
    /localeCompare/,
    /categories\.find\(/,
    /name: category\.name/,
    /icon: category\.icon/,
    /\.name ===/,
  ];

  const BYPASS = [
    { what: "icon", re: /\{ ?(?:row\.|entry\.|source\.|suggestion\.)?category!?\??\.icon/ },
    { what: "colour", re: /categoryColor\(|categoryAccent\(|budgetRowTreatment\(/ },
  ];

  it("finds no component re-deriving a category's icon or colour", () => {
    const root = join(process.cwd(), "components");
    const offenders: string[] = [];

    for (const file of walk(root)) {
      const rel = file.slice(root.length + 1).split("\\").join("/");
      readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
        for (const { what, re } of BYPASS) {
          if (!re.test(line)) continue;
          if (line.includes("categoryDisplay")) continue;
          if (ALLOWED.some((a) => a.test(line))) continue;
          offenders.push(`components/${rel}:${i + 1} (${what})  ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      `Use categoryDisplay() from lib/categoryRegistry.ts instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
