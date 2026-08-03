"use client";

import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  className?: string;
}

export function Card({ children, title, action, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-xl bg-surface shadow-card transition-[box-shadow] duration-200 hover:shadow-card-hover ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          {title && (
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
