"use client";

import { useMemo } from "react";
import { useToastStore } from "@/store/useToastStore";

export function useToast() {
  const push = useToastStore((s) => s.push);
  return useMemo(
    () => ({
      success: (message: string) => push(message, "success"),
      error: (message: string) => push(message, "error"),
      info: (message: string) => push(message, "info"),
    }),
    [push],
  );
}
