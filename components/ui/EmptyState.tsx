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
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && (
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}
        >
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
