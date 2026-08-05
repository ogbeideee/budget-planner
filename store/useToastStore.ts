import { create } from "zustand";
import { createId } from "@/lib/ids";
import type { ID } from "@/lib/types";

export type ToastTone = "success" | "error";

export interface ToastItem {
  id: ID;
  message: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: ToastItem[];
  push(message: string, tone?: ToastTone): void;
  dismiss(id: ID): void;
}

const DISMISS_MS = 3000;

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  push: (message, tone = "success") => {
    const id = createId();
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, DISMISS_MS);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
