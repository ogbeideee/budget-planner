import type { ReactNode } from "react";
import {
  ChartIcon,
  CheckSquareIcon,
  ClockIcon,
  GearIcon,
  GridIcon,
  type IconProps,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (props: IconProps) => ReactNode;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Planner", icon: GridIcon },
  { href: "/todo", label: "To-Do", icon: CheckSquareIcon },
  { href: "/history", label: "History", icon: ClockIcon },
  { href: "/reports", label: "Reports", icon: ChartIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];
