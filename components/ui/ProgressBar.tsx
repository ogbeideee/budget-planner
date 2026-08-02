"use client";

export type ProgressTone = "brand" | "warn" | "danger";

export interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
}

const TONES: Record<ProgressTone, string> = {
  brand: "bg-brand-600",
  warn: "bg-warn",
  danger: "bg-danger",
};

export function ProgressBar({ value, tone = "brand" }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-canvas"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-150 ease-out motion-reduce:transition-none ${TONES[tone]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
