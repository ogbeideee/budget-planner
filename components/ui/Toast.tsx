"use client";

import { XIcon } from "./icons";

export type ToastTone = "success" | "error";

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
}

const TONES: Record<ToastTone, string> = {
  success: "border-income/30 bg-surface text-ink",
  error: "border-danger/30 bg-surface text-ink",
};

export function Toast({ message, tone = "success", onDismiss }: ToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-center justify-between gap-4 rounded-md border px-4 py-3 shadow-pop animate-[toast-in_150ms_var(--ease-premium)] ${TONES[tone]}`}
    >
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mr-1 shrink-0 rounded-sm p-1 text-muted hover:text-ink"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
