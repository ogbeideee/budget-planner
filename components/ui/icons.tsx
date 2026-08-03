import type { ReactNode } from "react";

export interface IconProps {
  className?: string;
}

function Svg({
  className = "h-4 w-4",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </Svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </Svg>
  );
}

export function CheckSquareIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </Svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Svg>
  );
}

export function TrendingUpIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </Svg>
  );
}

export function ArrowDownLeftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M17 7 7 17" />
      <polyline points="17 17 7 17 7 7" />
    </Svg>
  );
}

export function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 17 17 7" />
      <polyline points="7 7 17 7 17 17" />
    </Svg>
  );
}

export function TargetIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  );
}

export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function SparklesIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </Svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h14" />
      <polyline points="12 5 19 12 12 19" />
    </Svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </Svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

export function ArrowRightToLineIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M17 12H3" />
      <path d="m11 18 6-6-6-6" />
      <path d="M21 5v14" />
    </Svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

export function DotIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
