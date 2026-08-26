"use client";

import type { ReactNode } from "react";
import { MetricIcon } from "./MetricIcon";
import { ProgressBar } from "./ProgressBar";
import type { ProgressTone } from "./ProgressBar";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  support?: ReactNode;
  progress?: { value: number; tone?: ProgressTone };
  icon?: ReactNode;
  iconClass?: string;
  chip?: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  compact?: boolean;
  labelExtra?: ReactNode;
  comparison?: ReactNode;
}

export function MetricCard({
  label,
  value,
  support,
  progress,
  icon,
  iconClass = "bg-sidebar-hover text-muted",
  chip,
  className = "",
  onClick,
  ariaLabel,
  compact = false,
  labelExtra,
  comparison,
}: MetricCardProps) {
  const chrome = `group relative flex min-h-[140px] flex-col rounded-xl border border-border/70 bg-surface p-4 text-left shadow-card transition-all duration-default ease-premium hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus:outline-none motion-reduce:transform-none ${
    compact ? "" : "justify-between"
  }`;
  const body = compact ? (
    <>
      <span className="flex items-start justify-between gap-3">
        <MetricIcon className={iconClass}>{icon}</MetricIcon>
        {chip && <span className="shrink-0 pt-0.5">{chip}</span>}
      </span>
      <span className="mt-2.5 flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1 truncate text-sm font-semibold text-muted">
          {label}
          {labelExtra}
        </span>
        <span className="whitespace-nowrap text-kpi-secondary font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
          {value}
        </span>
        {support && (
          <span className="text-caption font-medium tabular-nums text-muted">
            {support}
          </span>
        )}
        {progress && (
          <ProgressBar value={progress.value} tone={progress.tone} thin />
        )}
      </span>
      {comparison && (
        <span className="mt-auto flex items-center gap-1 pt-2.5">{comparison}</span>
      )}
    </>
  ) : (
    <>
      <span className="flex items-start justify-between gap-3">
        <MetricIcon className={iconClass}>{icon}</MetricIcon>
        {chip && <span className="shrink-0 pt-0.5">{chip}</span>}
      </span>
      <span className="flex min-w-0 flex-col gap-2">
        <span className="truncate text-sm font-semibold text-muted">
          {label}
        </span>
        <span className="whitespace-nowrap text-kpi-hero font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
          {value}
        </span>
        {support && (
          <span className="text-caption font-medium tabular-nums text-muted">
            {support}
          </span>
        )}
        {progress && (
          <ProgressBar value={progress.value} tone={progress.tone} thin />
        )}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" aria-label={ariaLabel} onClick={onClick} className={`${chrome} ${className}`}>
        {body}
      </button>
    );
  }
  return <div className={`${chrome} ${className}`}>{body}</div>;
}