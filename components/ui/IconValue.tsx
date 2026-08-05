"use client";

import {
  DEFAULT_ICON,
  isVectorIcon,
  VECTOR_ICON_COMPONENTS,
} from "@/components/settings/iconLibrary";

export function IconValue({
  value,
  className = "h-4 w-4",
}: {
  value: string;
  className?: string;
}) {
  const icon = value || DEFAULT_ICON;
  const Vector = isVectorIcon(icon) ? VECTOR_ICON_COMPONENTS[icon] : undefined;
  if (Vector) return <Vector className={className} />;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center ${className}`}
    >
      {icon}
    </span>
  );
}