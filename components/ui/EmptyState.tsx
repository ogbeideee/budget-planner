"use client";

import type { ReactNode } from "react";

export type EmptyIllustration =
  | "calendar"
  | "chart"
  | "list"
  | "target"
  | "clock"
  | "wallet";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  iconClass?: string;
  illustration?: EmptyIllustration;
  illustrationClass?: string;
  tip?: string;
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Illustration({ name }: { name: EmptyIllustration }) {
  switch (name) {
    case "calendar":
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true" {...STROKE}>
          <rect x="14" y="18" width="36" height="32" rx="7" />
          <path d="M22 12v8M42 12v8M14 28h36" />
          <path d="M24 38l5 5 11-12" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true" {...STROKE}>
          <path d="M14 46V36M26 46V26M38 46v-9M50 46V18" />
          <path d="M12 50h40" />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true" {...STROKE}>
          <circle cx="18" cy="24" r="3" />
          <path d="M27 24h22" />
          <path d="M18 38h22" opacity="0.55" />
          <path d="M18 48h13" opacity="0.35" />
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true" {...STROKE}>
          <circle cx="32" cy="32" r="20" />
          <circle cx="32" cy="32" r="10" opacity="0.55" />
          <circle cx="32" cy="32" r="3" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true" {...STROKE}>
          <circle cx="32" cy="32" r="20" />
          <path d="M32 22v10l8 5" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true" {...STROKE}>
          <rect x="12" y="18" width="40" height="30" rx="7" />
          <path d="M12 24h40M44 38h3" />
        </svg>
      );
  }
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  iconClass = "bg-sidebar-hover text-muted",
  illustration,
  illustrationClass = "bg-sidebar-hover text-muted",
  tip,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex h-20 w-20 animate-[overlay-in_180ms_var(--ease-premium)] items-center justify-center rounded-2xl"
      >
        {illustration ? (
          <span
            className={`flex h-20 w-20 items-center justify-center rounded-2xl ${illustrationClass}`}
          >
            <Illustration name={illustration} />
          </span>
        ) : (
          <span
            className={`flex h-20 w-20 items-center justify-center rounded-2xl ${iconClass}`}
          >
            {icon}
          </span>
        )}
      </span>
      <div className="flex animate-[list-in_220ms_var(--ease-premium)_both] flex-col gap-2">
        <p className="text-empty-title font-bold tracking-tight text-ink">
          {title}
        </p>
        <p className="mx-auto max-w-[480px] text-description leading-6 text-muted">
          {description}
        </p>
      </div>
      {action && (
        <div className="mt-4 animate-[list-in_220ms_var(--ease-premium)_both]">
          {action}
        </div>
      )}
      {tip && (
        <p className="mx-auto max-w-[480px] rounded-lg bg-surface/70 px-3 py-1.5 text-xs leading-relaxed text-muted">
          {tip}
        </p>
      )}
    </div>
  );
}
