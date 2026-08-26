"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useMonth } from "@/hooks/useMonth";
import { usePlannerStatus } from "@/hooks/usePlannerStatus";

export function Header() {
  const { month } = useMonth();
  const subtitle = usePlannerStatus(month);

  return (
    <header className="no-print sticky top-11 z-40 flex h-14 items-center gap-3 border-b border-border/70 bg-surface/95 px-6 backdrop-blur-md lg:hidden">
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
        {subtitle}
      </p>
      <ThemeToggle />
    </header>
  );
}
