"use client";

import { useToastStore } from "@/store/useToastStore";
import { Toast } from "./Toast";

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 lg:bottom-4"
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
