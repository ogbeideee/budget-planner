import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="animate-[page-in_220ms_var(--ease-premium)] flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 pb-1.5">
        <h1 className="text-page-title font-bold tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-description font-medium leading-7 text-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
