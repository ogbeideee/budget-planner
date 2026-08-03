"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm transition-[box-shadow] hover:bg-brand-700 hover:shadow-md active:shadow-sm",
  secondary:
    "border border-border bg-surface text-ink hover:bg-canvas hover:border-border/80",
  ghost: "text-muted hover:bg-canvas hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:scale-100 motion-reduce:translate-x-0 motion-reduce:translate-y-0 motion-reduce:transition-none ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
