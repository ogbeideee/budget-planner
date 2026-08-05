import type { ReactNode } from "react";

export interface SectionHeadingProps {
  children: ReactNode;
  action?: ReactNode;
}

export function SectionHeading({ children, action }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">
        {children}
      </h2>
      {action}
    </div>
  );
}
