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
    <section className={`rounded-lg bg-surface shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
