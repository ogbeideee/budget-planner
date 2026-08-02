"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";
import type { Theme } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function useTheme() {
  const theme = useAppStore((s) => s.state.settings.theme);
  const setSettings = useAppStore((s) => s.setSettings);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme: (next: Theme) => setSettings({ theme: next }),
  };
}
