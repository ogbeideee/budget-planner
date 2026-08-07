"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

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
  className?: string;
}

const GAP_DEGREES = 3;

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  centerTrend,
  activeId = null,
  onSegmentHover,
  size = 220,
  className = "",
}: DonutChartProps) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const total = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.value, 0),
    [segments],
  );

  const strokeWidth = Math.max(18, Math.round(size / 10));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcs = useMemo(() => {
    const gap = (GAP_DEGREES / 360) * circumference;
    const unit = total > 0 ? circumference / total : 0;
    return segments.map((segment, index) => {
      const fraction = total > 0 ? segment.value / total : 0;
      const length = fraction * circumference;
      const start = segments
        .slice(0, index)
        .reduce((sum, prev) => sum + prev.value, 0) * unit;
      return {
        segment,
        start,
        length,
        dash: `${Math.max(0, length - gap)} ${circumference}`,
        offset: circumference / 4 - start - gap / 2,
      };
    });
  }, [segments, total, circumference]);

  const focused = activeId ?? hovered;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          total > 0
            ? `Allocation: ${segments
                .map((segment) => `${segment.label} ${segment.value}`)
                .join(", ")}`
            : "No allocation yet"
        }
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={strokeWidth}
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map(({ segment, dash, offset }) => {
            const isActive = focused === segment.id;
            return (
              <circle
                key={segment.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                strokeLinecap="round"
                strokeDasharray={mounted ? dash : `0 ${circumference}`}
                strokeDashoffset={offset}
                className="transition-[stroke-width,stroke-dasharray] duration-slow ease-premium motion-reduce:transition-none"
                onMouseEnter={() => {
                  setHovered(segment.id);
                  onSegmentHover?.(segment.id);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  onSegmentHover?.(null);
                }}
              />
            );
          })}
        </g>
      </svg>
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
