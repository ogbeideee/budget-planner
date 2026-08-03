import type { ReactNode } from "react";
import {
  CalendarIcon,
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
  { href: "/upcoming", label: "Upcoming", icon: CalendarIcon },
  { href: "/history", label: "Timeline", icon: ClockIcon },
  { href: "/reports", label: "Reports", icon: ChartIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];
