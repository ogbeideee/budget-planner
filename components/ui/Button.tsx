"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 hover:shadow-card active:bg-brand-700",
  secondary:
    "border border-border bg-surface text-ink hover:bg-sidebar-hover hover:border-border",
  ghost: "text-muted hover:bg-sidebar-hover hover:text-ink",
  danger:
    "border border-danger/50 bg-surface text-danger hover:bg-expense-surface",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-8 gap-1.5 px-3 text-sm",
  md: "min-h-10 gap-2 px-4 text-base",
  lg: "min-h-11 gap-2.5 px-5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-semibold transition-all duration-150 ease-premium active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
