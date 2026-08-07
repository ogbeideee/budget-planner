import type { ReactNode } from "react";

export interface SectionHeadingProps {
  children: ReactNode;
  description?: string;
  action?: ReactNode;
}

export function SectionHeading({
  children,
  description,
  action,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-section-title font-bold tracking-tight text-ink">
          {children}
        </h2>
        {description && (
          <p className="mt-1 text-base font-medium text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
