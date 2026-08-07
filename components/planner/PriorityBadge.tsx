"use client";

import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import type { Priority } from "@/lib/types";

const LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const VARIANTS: Record<Priority, BadgeVariant> = {
  high: "warning",
  medium: "neutral",
  low: "neutral",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant={VARIANTS[priority]} title={`Priority: ${LABELS[priority]}`}>
      {LABELS[priority]}
    </Badge>
  );
}
