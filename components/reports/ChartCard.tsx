"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <Card
      title={title}
      action={
        subtitle ? (
          <span className="text-sm font-medium text-muted">{subtitle}</span>
        ) : undefined
      }
    >
      {children}
    </Card>
  );
}
