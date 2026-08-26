import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DonutChart } from "./DonutChart";

const SEGMENTS = [
  { id: "edi", label: "Edi", value: 60, color: "#22c55e" },
  { id: "transport", label: "Transport", value: 45, color: "#eab308" },
  { id: "internet", label: "internet", value: 30, color: "#ef4444" },
  { id: "essentials", label: "Essentials", value: 25, color: "#ef4444" },
  { id: "palmpay", label: "Palmpay", value: 20, color: "#0ea5e9" },
  { id: "misc", label: "Misc", value: 15, color: "#ef4444" },
  { id: "loan", label: "Loan", value: 12, color: "#ef4444" },
];

const TOTAL = SEGMENTS.reduce((sum, s) => sum + s.value, 0);

function renderChart(segments = SEGMENTS, props = {}) {
  return render(
    <DonutChart
      segments={segments}
      size={180}
      centerValue={<span>centre</span>}
      {...props}
    />,
  );
}

/** jsdom serializes authored hex colors to `rgb(r, g, b)`. */
function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function ring(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[data-testid="donut-ring"]')!;
}

/** Parsed `color start% end%` triples from the ring's conic-gradient. */
function stops(container: HTMLElement) {
  const bg = ring(container).style.background;
  const inner = bg.slice(bg.indexOf("(") + 1, bg.lastIndexOf(")"));
  return inner.split(/,(?![^(]*\))/).map((raw) => {
    const m = raw.trim().match(/^(.+?)\s+([\d.]+)%\s+([\d.]+)%$/)!;
    return { color: m[1].trim(), start: Number(m[2]), end: Number(m[3]) };
  });
}

describe("DonutChart ring", () => {
  it("paints one continuous conic-gradient, not stroked arcs", () => {
    const { container } = renderChart();

    expect(ring(container).style.background).toContain("conic-gradient");
    // No stroked ring left behind, and therefore no rounded caps.
    expect(container.querySelector("circle")).toBeNull();
    expect(container.querySelector('[stroke-linecap="round"]')).toBeNull();
    expect(container.innerHTML).not.toContain("strokeLinecap");
  });

  it("gives every category one stop, in order, sized to its share", () => {
    const { container } = renderChart();
    const parsed = stops(container);

    expect(parsed).toHaveLength(SEGMENTS.length);
    parsed.forEach((stop, i) => {
      expect(stop.color).toBe(rgb(SEGMENTS[i].color));
      const share = (SEGMENTS[i].value / TOTAL) * 100;
      expect(stop.end - stop.start).toBeCloseTo(share, 4);
    });
  });

  it("leaves NO gap anywhere — each color starts exactly where the last ended", () => {
    const { container } = renderChart();
    const parsed = stops(container);

    expect(parsed[0].start).toBe(0);
    for (let i = 1; i < parsed.length; i++) {
      // Hard edge: identical boundary value, so no background shows through.
      expect(parsed[i].start).toBe(parsed[i - 1].end);
    }
    expect(parsed[parsed.length - 1].end).toBeCloseTo(100, 6);
  });

  it("punches a hollow centre with a hard-edged mask", () => {
    const { container } = renderChart();
    const style = ring(container).style;
    const mask = style.maskImage || style.getPropertyValue("-webkit-mask-image");

    expect(mask).toContain("radial-gradient");
    // Default innerRatio 0.7 on a 180px donut => 63px inner radius.
    expect(mask).toContain("63px");
  });

  it("honours a custom innerRatio", () => {
    const { container } = renderChart(SEGMENTS, { innerRatio: 0.5 });
    const style = ring(container).style;
    const mask = style.maskImage || style.getPropertyValue("-webkit-mask-image");

    expect(mask).toContain("45px");
  });

  it("keeps a hover hit area per category even when colors repeat", () => {
    const { container } = renderChart();
    const paths = Array.from(container.querySelectorAll("path"));

    expect(paths).toHaveLength(SEGMENTS.length);
    expect(container.querySelectorAll('path[data-color="#ef4444"]')).toHaveLength(4);
    // Hit areas are invisible; the gradient underneath supplies the color.
    for (const path of paths) {
      expect(path.getAttribute("fill")).toBe("transparent");
    }
  });

  it("highlights only the active segment", () => {
    const { container } = renderChart(SEGMENTS, { activeId: "transport" });
    const active = container.querySelector('path[data-segment="transport"]')!;
    const other = container.querySelector('path[data-segment="edi"]')!;

    expect(active.getAttribute("fill")).not.toBe("transparent");
    expect(other.getAttribute("fill")).toBe("transparent");
  });

  it("drops zero-value categories so they cannot seam two colors", () => {
    const { container } = renderChart([
      ...SEGMENTS.slice(0, 2),
      { id: "empty", label: "Empty", value: 0, color: "#000000" },
    ]);
    const parsed = stops(container);

    expect(parsed).toHaveLength(2);
    expect(parsed.some((s) => s.color === rgb("#000000"))).toBe(false);
    expect(container.querySelector('path[data-segment="empty"]')).toBeNull();
  });

  it("renders a plain track and no segments when everything is zero", () => {
    const { container } = renderChart(
      SEGMENTS.map((segment) => ({ ...segment, value: 0 })),
    );

    expect(container.querySelectorAll("path")).toHaveLength(0);
    expect(ring(container).style.background).not.toContain("conic-gradient");
  });

  it("draws a single full category as a complete ring", () => {
    const { container } = renderChart([SEGMENTS[0]]);
    const bg = ring(container).style.background;

    // A gradient needs two stops to be valid CSS; jsdom (like a browser)
    // drops a one-stop gradient entirely, which would paint a blank ring.
    expect(bg).toContain("conic-gradient");
    expect(bg).toContain("0% 100%");
    expect(stops(container)).toHaveLength(2);
    // Split into two half-arcs so a 360deg sweep does not collapse to nothing.
    const d = container.querySelector("path")!.getAttribute("d")!;
    expect(d.match(/M /g)).toHaveLength(2);
  });

  it("exposes the allocation as an accessible label", () => {
    const { container } = renderChart();
    expect(ring(container)).toHaveAttribute(
      "aria-label",
      "Allocation: Edi 60, Transport 45, internet 30, Essentials 25, Palmpay 20, Misc 15, Loan 12",
    );
  });
});
