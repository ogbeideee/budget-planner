"use client";

export type ProgressTone = "brand" | "success" | "warn" | "danger";

export interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  thin?: boolean;
  className?: string;
  /** Overrides the fill color (e.g. a per-category accent). */
  fillColor?: string;
  /**
   * Draws a vertical tick at this 0–100 position along the bar — used to mark
   * where an over-budget category crossed its limit inside the full bar.
   */
  markerPercent?: number;
  /** Accessible description of the marker. */
  markerLabel?: string;
}

const TONES: Record<ProgressTone, string> = {
  brand: "bg-brand-500",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
};

export function ProgressBar({
  value,
  tone = "brand",
  thin = false,
  className = "",
  fillColor,
  markerPercent,
  markerLabel,
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  const marker =
    markerPercent === undefined
      ? null
      : Math.min(100, Math.max(0, markerPercent));
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`relative w-full overflow-hidden rounded-full bg-track ${thin ? "h-[6px]" : "h-2"} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-slow ease-premium motion-reduce:transition-none ${TONES[tone]}`}
        style={{
          width: `${percent}%`,
          ...(fillColor ? { backgroundColor: fillColor } : {}),
        }}
        aria-hidden="true"
      />
      {marker !== null && (
        <span
          data-testid="progress-marker"
          title={markerLabel}
          aria-hidden="true"
          className="absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-full bg-surface/90 mix-blend-normal"
          style={{ left: `${marker}%` }}
        />
      )}
    </div>
  );
}
