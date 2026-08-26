import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { BudgetList } from "./BudgetList";
import type { Category } from "@/lib/types";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function seedUserData() {
  const state = useAppStore.getState().state;
  const categories: Category[] = [
    { ...state.categories[0], id: "cat-edi", name: "Edi", icon: "🛒", color: "#22c55e", kind: "expense" },
    { ...state.categories[0], id: "cat-transport", name: "Transport", icon: "🚌", color: "#eab308", kind: "expense" },
    { ...state.categories[0], id: "cat-internet", name: "internet", icon: "🌐", color: "#ef4444", kind: "expense" },
    { ...state.categories[0], id: "cat-essentials", name: "Essentials", icon: "🧺", color: "#ef4444", kind: "expense" },
    { ...state.categories[0], id: "cat-palmpay", name: "Palmpay", icon: "📱", color: "#0ea5e9", kind: "expense" },
    { ...state.categories[0], id: "cat-misc", name: "Misc", icon: "📦", color: "#ef4444", kind: "expense" },
    { ...state.categories[0], id: "cat-loan", name: "Loan", icon: "🏦", color: "#ef4444", kind: "expense" },
  ];
  const budgets = [
    { id: "b-edi", categoryId: "cat-edi", month: "2026-08", limit: 60000, priority: "high" as const },
    { id: "b-transport", categoryId: "cat-transport", month: "2026-08", limit: 45000, priority: "high" as const },
    { id: "b-internet", categoryId: "cat-internet", month: "2026-08", limit: 30000, priority: "high" as const },
    { id: "b-essentials", categoryId: "cat-essentials", month: "2026-08", limit: 25000, priority: "high" as const },
    { id: "b-palmpay", categoryId: "cat-palmpay", month: "2026-08", limit: 20000, priority: "high" as const },
    { id: "b-misc", categoryId: "cat-misc", month: "2026-08", limit: 15000, priority: "high" as const },
    { id: "b-loan", categoryId: "cat-loan", month: "2026-08", limit: 12000, priority: "high" as const },
  ];
  useAppStore.setState({
    state: {
      ...state,
      categories,
      budgets,
      incomePlans: [
        {
          id: "plan-1",
          month: "2026-08",
          name: "Salary",
          icon: "💰",
          expectedAmount: 340000,
          receivedAmount: 340000,
        },
      ],
    },
  });
}

function donutRing(): HTMLElement {
  render(<BudgetList month="2026-08" />);
  const section = document.querySelector("#budget-allocation")!;
  return section.querySelector<HTMLElement>('[data-testid="donut-ring"]')!;
}

/** Per-category hover hit areas, which carry the colour the ring painted. */
function segmentColors(ring: HTMLElement): string[] {
  const svg = ring.parentElement!.querySelector("svg")!;
  return Array.from(svg.querySelectorAll("path[data-color]")).map(
    (path) => path.getAttribute("data-color")!,
  );
}

describe("Budgets donut with duplicate category colors", () => {
  it("renders exactly one flush wedge per category (7 budgets -> 7 stops)", () => {
    seedUserData();
    const ring = donutRing();
    const bg = ring.style.background;

    expect(bg).toContain("conic-gradient");
    expect(segmentColors(ring)).toHaveLength(7);

    // Every stop must start exactly where the previous ended — no gaps, and
    // no rounded caps anywhere now that the ring is a single gradient.
    const bounds = [...bg.matchAll(/([\d.]+)% ([\d.]+)%/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(bounds).toHaveLength(7);
    expect(bounds[0][0]).toBe(0);
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i][0]).toBe(bounds[i - 1][1]);
    }
    expect(bounds[bounds.length - 1][1]).toBeCloseTo(100, 6);
    expect(ring.parentElement!.querySelector('[stroke-linecap="round"]')).toBeNull();
  });

  it("keeps 4 red categories as 4 wedges, each with a distinct visible color", () => {
    seedUserData();
    const colors = segmentColors(donutRing());

    expect(colors).toHaveLength(7);
    expect(new Set(colors).size).toBe(7);
    expect(colors.filter((color) => color === "#ef4444")).toHaveLength(1);
  });
});
