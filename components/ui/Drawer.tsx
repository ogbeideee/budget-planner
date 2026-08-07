"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { XIcon } from "@/components/ui/icons";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scrollLock";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    lockBodyScroll();
    if (panelRef.current) panelRef.current.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!panelRef.current?.contains(document.activeElement)) return;
      // A nested dialog owns its own focus trap — never react to keys
      // targeted inside it.
      const nestedDialog = panelRef.current.querySelector('[role="dialog"]');
      if (nestedDialog?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      unlockBodyScroll();
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 animate-[overlay-in_180ms_var(--ease-premium)] bg-overlay/40 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex h-full max-h-full w-full max-w-[420px] animate-[drawer-in_220ms_var(--ease-premium)] flex-col border-l border-border/60 bg-surface shadow-pop focus:outline-none motion-reduce:animate-none"
      >
        <header className="flex items-center justify-between gap-3 px-6 pt-6">
          <h2
            id={titleId}
            className="min-w-0 truncate text-card-title font-bold tracking-tight"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-sidebar-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && (
          <footer className="border-t border-border/60 px-6 py-5">{footer}</footer>
        )}
      </div>
    </div>
  );
}
