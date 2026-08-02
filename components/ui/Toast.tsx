"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const timeout = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center justify-between gap-4 rounded-md border px-4 py-3 shadow-pop ${TONES[tone]}`}
    >
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-sm font-semibold text-muted hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
