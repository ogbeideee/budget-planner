"use client";

import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  iconClass?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  iconClass = "bg-canvas text-muted",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      {icon && (
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-card ${iconClass}`}
        >
          {icon}
        </span>
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
    </div>
  );
}
