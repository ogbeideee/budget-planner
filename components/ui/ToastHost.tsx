"use client";

import { useToastStore } from "@/store/useToastStore";
import { Toast } from "./Toast";

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col items-end gap-2 px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
    </div>
  );
}
