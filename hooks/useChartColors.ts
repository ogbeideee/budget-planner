"use client";

import { useEffect, useState } from "react";

export interface ChartColors {
  grid: string;
  tick: string;
  ink: string;
  surface: string;
  border: string;
  brand: string;
  income: string;
  expense: string;
}

const LIGHT: ChartColors = {
  grid: "#e2e8f0",
  tick: "#64748b",
  ink: "#0f172a",
  surface: "#ffffff",
  border: "#e2e8f0",
  brand: "#5e6ad2",
  income: "#16a34a",
  expense: "#dc2626",
};

const TOKENS: Array<{ name: keyof ChartColors; cssVar: string }> = [
  { name: "grid", cssVar: "--color-border" },
  { name: "tick", cssVar: "--color-muted" },
  { name: "ink", cssVar: "--color-ink" },
  { name: "surface", cssVar: "--color-surface" },
  { name: "border", cssVar: "--color-border" },
  { name: "brand", cssVar: "--color-brand-500" },
  { name: "income", cssVar: "--color-income" },
  { name: "expense", cssVar: "--color-expense" },
];

function readColors(): ChartColors {
  if (typeof document === "undefined") return LIGHT;
  const styles = getComputedStyle(document.documentElement);
  const colors = { ...LIGHT };
  for (const { name, cssVar } of TOKENS) {
    const value = styles.getPropertyValue(cssVar).trim();
    if (value) colors[name] = value;
  }
  return colors;
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(LIGHT);

  useEffect(() => {
    const update = () => setColors(readColors());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
