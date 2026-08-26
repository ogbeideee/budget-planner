"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface DonutChartSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutChartSegment[];
  centerValue: ReactNode;
  centerLabel?: string;
  centerTrend?: ReactNode;
  /** Controlled hover: highlight a segment by id (e.g. from a legend). */
  activeId?: string | null;
  onSegmentHover?: (id: string | null) => void;
  size?: number;
  /**
   * Hole diameter as a fraction of the outer diameter. Lower = thicker ring.
   * The hole is punched with a mask, so it is genuinely transparent and the
   * card behind it shows through whatever the theme is.
   */
  innerRatio?: number;
  className?: string;
}

/**
 * Hole diameter / outer diameter. 0.70 keeps the ring visibly thick (27px at
 * the Planner's 180px donut, vs the 18px stroke it replaced) while leaving the
 * hole wide enough for the "of {total} · {pct}%" line. Going much tighter —
 * a 40-45% cutout, say — makes that line overflow onto the ring.
 */
const DEFAULT_INNER_RATIO = 0.7;

/** Point on a circle; 0rad is 12 o'clock, angles run clockwise. */
function point(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

/**
 * Annulus sector between two angles. These paths are invisible — they exist
 * only as hover hit areas and as the highlight surface for the active segment;
 * the visible ring itself is one conic-gradient, which is what guarantees the
 * flush, hard-edged joins.
 */
function sectorPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  const sweep = end - start;
  // A single 360° arc collapses to nothing, so split a full ring in half.
  if (sweep >= Math.PI * 2 - 1e-6) {
    const mid = start + Math.PI;
    return (
      sectorPath(cx, cy, rOuter, rInner, start, mid) +
      " " +
      sectorPath(cx, cy, rOuter, rInner, mid, start + Math.PI * 2)
    );
  }
  const large = sweep > Math.PI ? 1 : 0;
  const o0 = point(cx, cy, rOuter, start);
  const o1 = point(cx, cy, rOuter, end);
  const i1 = point(cx, cy, rInner, end);
  const i0 = point(cx, cy, rInner, start);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  centerTrend,
  activeId = null,
  onSegmentHover,
  size = 220,
  innerRatio = DEFAULT_INNER_RATIO,
  className = "",
}: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const total = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.value, 0),
    [segments],
  );

  // Zero-value categories would render as an invisible 0°-wide wedge; drop them
  // so they never sit between two colors as a seam.
  const drawn = useMemo(
    () => (total > 0 ? segments.filter((segment) => segment.value > 0) : []),
    [segments, total],
  );

  /**
   * One contiguous run of stops: each color starts exactly where the previous
   * one ended, so every join is a hard edge with no gap and no rounded cap.
   */
  const { gradient, arcs } = useMemo(() => {
    if (drawn.length === 0) return { gradient: null, arcs: [] };
    const cx = size / 2;
    const rOuter = size / 2;
    // Rounded so float noise (0.7 * 180 / 2 = 62.99999...) never reaches the CSS.
  const rInner = Math.round(((size * innerRatio) / 2) * 100) / 100;
    const stops: string[] = [];
    const sectors: Array<{ segment: DonutChartSegment; d: string }> = [];
    let acc = 0;
    for (const segment of drawn) {
      const start = acc;
      acc += (segment.value / total) * 100;
      stops.push(`${segment.color} ${start}% ${acc}%`);
      sectors.push({
        segment,
        d: sectorPath(
          cx,
          cx,
          rOuter,
          rInner,
          (start / 100) * Math.PI * 2,
          (acc / 100) * Math.PI * 2,
        ),
      });
    }
    // A gradient needs at least TWO stops to be valid CSS — a lone category
    // covering the whole ring would otherwise be dropped and paint nothing.
    if (stops.length === 1) stops.push(`${drawn[0].color} 100% 100%`);
    return { gradient: `conic-gradient(${stops.join(", ")})`, arcs: sectors };
  }, [drawn, total, size, innerRatio]);

  const focused = activeId ?? hovered;
  // Punch the hole with a hard-stop radial mask rather than covering the
  // middle with an opaque disc, so the hole is truly transparent on any card.
  // Rounded so float noise (0.7 * 180 / 2 = 62.99999...) never reaches the CSS.
  const rInner = Math.round(((size * innerRatio) / 2) * 100) / 100;
  const hole = `radial-gradient(circle at 50% 50%, transparent 0 ${rInner}px, #000 ${rInner}px 100%)`;
  const maskStyle: CSSProperties = { maskImage: hole, WebkitMaskImage: hole };

  const label =
    total > 0
      ? `Allocation: ${segments
          .map((segment) => `${segment.label} ${segment.value}`)
          .join(", ")}`
      : "No allocation yet";

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        role="img"
        aria-label={label}
        data-testid="donut-ring"
        className="absolute inset-0 rounded-full"
        style={{
          ...maskStyle,
          background: gradient ?? "var(--color-track)",
        }}
      />
      {arcs.length > 0 && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
          className="absolute inset-0"
        >
          {arcs.map(({ segment, d }) => (
            <path
              key={segment.id}
              d={d}
              data-segment={segment.id}
              data-color={segment.color}
              fill={
                focused === segment.id ? "rgb(255 255 255 / 0.22)" : "transparent"
              }
              className="transition-[fill] duration-slow ease-premium motion-reduce:transition-none"
              onMouseEnter={() => {
                setHovered(segment.id);
                onSegmentHover?.(segment.id);
              }}
              onMouseLeave={() => {
                setHovered(null);
                onSegmentHover?.(null);
              }}
            />
          ))}
        </svg>
      )}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
        <span className="font-bold tracking-[-0.03em] tabular-nums text-ink">
          {centerValue}
        </span>
        {centerLabel && (
          <span className="text-caption font-medium text-muted">
            {centerLabel}
          </span>
        )}
        {centerTrend}
      </div>
    </div>
  );
}
