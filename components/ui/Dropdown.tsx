"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface DropdownItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
  destructive?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  ariaLabel: string;
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  align = "right",
  ariaLabel,
  className = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center rounded-md transition-colors duration-150 ease-premium hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className={`absolute top-full z-50 mt-2 min-w-48 rounded-md border border-border/70 bg-surface p-2 shadow-pop animate-[menu-in_160ms_var(--ease-premium)] motion-reduce:animate-none ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              aria-current={item.selected ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect?.();
              }}
              className={`flex h-11 w-full items-center gap-2.5 rounded-md px-3 text-base font-medium transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none ${
                item.destructive
                  ? "text-danger hover:bg-expense-surface"
                  : item.selected
                    ? "bg-sidebar-active text-brand-600"
                    : "text-ink hover:bg-sidebar-hover"
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
