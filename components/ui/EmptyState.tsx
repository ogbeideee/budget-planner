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
        <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true" {...STROKE}>
          <rect x="14" y="18" width="36" height="32" rx="7" />
          <path d="M22 12v8M42 12v8M14 28h36" />
          <path d="M24 38l5 5 11-12" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true" {...STROKE}>
          <path d="M14 46V36M26 46V26M38 46v-9M50 46V18" />
          <path d="M12 50h40" />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true" {...STROKE}>
          <circle cx="18" cy="24" r="3" />
          <path d="M27 24h22" />
          <path d="M18 38h22" opacity="0.55" />
          <path d="M18 48h13" opacity="0.35" />
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true" {...STROKE}>
          <circle cx="32" cy="32" r="20" />
          <circle cx="32" cy="32" r="10" opacity="0.55" />
          <circle cx="32" cy="32" r="3" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true" {...STROKE}>
          <circle cx="32" cy="32" r="20" />
          <path d="M32 22v10l8 5" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true" {...STROKE}>
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
  iconClass = "bg-canvas text-muted",
  illustration,
  illustrationClass = "bg-canvas text-muted",
  tip,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      {illustration ? (
        <span
          aria-hidden="true"
          className={`flex h-16 w-16 items-center justify-center rounded-2xl ${illustrationClass}`}
        >
          <Illustration name={illustration} />
        </span>
      ) : (
        icon && (
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-card ${iconClass}`}
          >
            {icon}
          </span>
        )
      )}
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold tracking-tight text-ink">
          {title}
        </p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {action && <div className="mt-1">{action}</div>}
      {tip && (
        <p className="mx-auto max-w-md rounded-lg bg-surface/60 px-3 py-1.5 text-xs leading-relaxed text-muted">
          {tip}
        </p>
      )}
    </div>
  );
}
