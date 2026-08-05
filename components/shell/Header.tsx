"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { WalletIcon } from "@/components/ui/icons";
import { useMonth } from "@/hooks/useMonth";
import { usePlannerStatus } from "@/hooks/usePlannerStatus";

export function Header() {
  const { month } = useMonth();
  const subtitle = usePlannerStatus(month);

  return (
    <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
        <WalletIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-base font-bold tracking-tight">Budget Planner</p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      <ThemeToggle />
    </header>
  );
}
