"use client";

export type ProgressTone = "brand" | "success" | "warn" | "danger";

export interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  thin?: boolean;
  className?: string;
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
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full bg-track ${thin ? "h-[3px]" : "h-2"} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-slow ease-premium motion-reduce:transition-none ${TONES[tone]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
