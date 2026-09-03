import type { ReactNode } from "react";
import {
  CalendarIcon,
  ChartIcon,
  CheckSquareIcon,
  ClockIcon,
  GearIcon,
  GridIcon,
  TargetIcon,
  WalletIcon,
  type IconProps,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  /** Used by the mobile bottom bar, where a cell is ~50px wide. Falls back to
   *  `label`; only set it when the full label cannot fit. */
  shortLabel?: string;
  icon: (props: IconProps) => ReactNode;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Planner", icon: GridIcon },
  { href: "/todo", label: "To-Do", icon: CheckSquareIcon },
  { href: "/upcoming", label: "Upcoming", icon: CalendarIcon },
  { href: "/history", label: "Timeline", icon: ClockIcon },
  { href: "/reports", label: "Reports", icon: ChartIcon },
  { href: "/debt", label: "Debt payoff", shortLabel: "Debt", icon: WalletIcon },
  { href: "/savings", label: "Savings", shortLabel: "Save", icon: TargetIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];
