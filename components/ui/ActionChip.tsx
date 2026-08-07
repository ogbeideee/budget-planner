import type { ReactNode } from "react";

export interface ActionChipProps {
  children: ReactNode;
  className?: string;
}

export function ActionChip({ children, className = "" }: ActionChipProps) {
  return (
    <span
      className={`inline-flex h-[30px] shrink-0 items-center rounded-full bg-sidebar-hover px-3.5 text-caption font-medium text-secondary ${className}`}
    >
      {children}
    </span>
  );
}
