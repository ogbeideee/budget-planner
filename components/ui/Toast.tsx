"use client";

import { XIcon } from "./icons";

export type ToastTone = "success" | "error" | "info";

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
}

const TONES: Record<ToastTone, string> = {
  success: "border-l-success",
  error: "border-l-danger",
  info: "border-l-savings-text",
};

export function Toast({ message, tone = "success", onDismiss }: ToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-center justify-between gap-4 rounded-md border border-border/70 border-l-4 bg-surface py-3 pl-5 pr-3 shadow-card-hover animate-[toast-in_180ms_var(--ease-premium)] ${TONES[tone]}`}
    >
      <p className="text-sm font-medium text-ink">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mr-1 shrink-0 rounded-sm p-1.5 text-muted transition-colors hover:bg-sidebar-hover hover:text-ink"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
