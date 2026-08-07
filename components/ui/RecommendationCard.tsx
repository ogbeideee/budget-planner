import type { ReactNode } from "react";

export type RecommendationType = "success" | "warning" | "information" | "critical";

export interface RecommendationCardProps {
  type?: RecommendationType;
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const STYLES: Record<RecommendationType, string> = {
  success: "bg-reco-success border-reco-success-border",
  warning: "bg-reco-warning border-reco-warning-border",
  information: "bg-reco-info border-reco-info-border",
  critical: "bg-reco-critical border-reco-critical-border",
};

const ICON_STYLES: Record<RecommendationType, string> = {
  success: "bg-success-surface text-success-text",
  warning: "bg-upcoming-surface text-warn-text",
  information: "bg-savings-surface text-savings-text",
  critical: "bg-expense-surface text-danger-text",
};

export function RecommendationCard({
  type = "information",
  icon,
  title,
  description,
  action,
  className = "",
}: RecommendationCardProps) {
  return (
    <div
      className={`flex items-center gap-5 rounded-xl border p-6 transition-shadow duration-default ease-premium hover:shadow-card-hover ${STYLES[type]} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ICON_STYLES[type]}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-card-title font-bold tracking-tight text-ink">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 text-sm font-medium leading-5 text-secondary">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
