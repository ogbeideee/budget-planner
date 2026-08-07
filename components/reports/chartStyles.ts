import type { ChartColors } from "@/hooks/useChartColors";

export function tooltipContentStyle(colors: ChartColors) {
  return {
    borderRadius: 14,
    border: "none",
    background: colors.tooltip,
    boxShadow: "0 12px 40px rgb(15 23 42 / 0.3)",
    fontSize: 13,
    fontWeight: 500,
    padding: 16,
    color: colors.tooltipText,
  };
}

export function axisTickStyle(colors: ChartColors) {
  return { fill: colors.tick, fontSize: 12 };
}
