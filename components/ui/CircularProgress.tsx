"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface CircularProgressProps {
  /** Progress from 0 to 1. */
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: "brand" | "success" | "warn" | "danger";
  className?: string;
  children?: ReactNode;
}

const TONES = {
  brand: "stroke-brand-500",
  success: "stroke-success",
  warn: "stroke-warn",
  danger: "stroke-danger",
} as const;

export function CircularProgress({
  value,
  size = 132,
  strokeWidth = 10,
  tone = "brand",
  className = "",
  children,
}: CircularProgressProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={mounted ? `${clamped * circumference} ${circumference}` : `0 ${circumference}`}
          strokeDashoffset={circumference / 4}
          className={`${TONES[tone]} transition-[stroke-dasharray] duration-slow ease-premium motion-reduce:transition-none`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
