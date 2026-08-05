"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scrollLock";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  describedBy?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  describedBy,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
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
    if (dialogRef.current) dialogRef.current.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialogRef.current?.contains(document.activeElement)) return;
      // A nested dialog (e.g. IconPicker inside a form modal) owns its own
      // focus trap — never react to keys targeted inside it.
      const nestedDialog = dialogRef.current.querySelector('[role="dialog"]');
      if (nestedDialog?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px] animate-[overlay-in_180ms_var(--ease-premium)]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-xl border border-border/60 bg-surface shadow-pop animate-[dialog-in_180ms_var(--ease-premium)] focus:outline-none`}
      >
        <h2
          id={titleId}
          className="flex shrink-0 items-center gap-2 border-b border-border/50 px-6 py-4 text-lg font-bold tracking-tight"
        >
          {title}
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-border/50 bg-surface px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}


