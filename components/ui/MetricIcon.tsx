import type { ReactNode } from "react";

export interface MetricIconProps {
  children: ReactNode;
  className?: string;
}

export function MetricIcon({ children, className = "" }: MetricIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-default ease-premium ${className}`}
    >
      {children}
    </span>
  );
}
