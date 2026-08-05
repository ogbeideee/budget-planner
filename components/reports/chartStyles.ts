import type { ChartColors } from "@/hooks/useChartColors";

export function tooltipContentStyle(colors: ChartColors) {
  return {
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    boxShadow: "0 8px 24px rgb(15 23 42 / 0.08)",
    fontSize: 12,
    color: colors.ink,
  };
}

export function axisTickStyle(colors: ChartColors) {
  return { fill: colors.tick, fontSize: 12 };
}
