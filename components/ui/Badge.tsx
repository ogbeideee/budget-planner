import type { ReactNode } from "react";

export type BadgeVariant =
  | "income"
  | "expense"
  | "budget"
  | "upcoming"
  | "draft"
  | "completed"
  | "cancelled"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  uppercase?: boolean;
  title?: string;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  income: "bg-success-surface text-success-text",
  expense: "bg-expense-surface text-danger-text",
  budget: "bg-savings-surface text-savings-text",
  upcoming: "bg-upcoming-surface text-warn-text",
  draft: "bg-timeline-surface text-timeline-text",
  completed: "bg-health-surface text-health-text",
  cancelled: "bg-timeline-surface text-disabled",
  success: "bg-success-surface text-success-text",
  warning: "bg-upcoming-surface text-warn-text",
  danger: "bg-expense-surface text-danger-text",
  info: "bg-savings-surface text-savings-text",
  neutral: "bg-sidebar-hover text-secondary",
};

export function Badge({
  children,
  variant = "neutral",
  uppercase = false,
  title,
  className = "",
}: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-bold ${VARIANTS[variant]} ${
        uppercase ? "uppercase tracking-[0.06em]" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}
