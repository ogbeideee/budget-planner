"use client";

import { useCallback, useEffect, useState } from "react";
import { getStorageBackend } from "@/lib/storageAdapter";
import {
  ACCENT_STORAGE_KEY,
  ANIMATIONS_STORAGE_KEY,
  applyAccent,
  applyAnimations,
  readAccent,
  readAnimations,
  resolveAccent,
  resolveAnimations,
} from "@/lib/theme";
import type { Accent, AnimationsPref } from "@/lib/theme";

function writeAppearance(key: string, value: string): void {
  try {
    getStorageBackend().setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — preference stays session-only
  }
}

export function useAppearance() {
  const [accent, setAccentState] = useState<Accent>(() =>
    resolveAccent(readAccent()),
  );
  const [animations, setAnimationsState] = useState<AnimationsPref>(() =>
    resolveAnimations(readAnimations()),
  );

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    applyAnimations(animations);
  }, [animations]);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    writeAppearance(ACCENT_STORAGE_KEY, next);
  }, []);

  const setAnimations = useCallback((next: AnimationsPref) => {
    setAnimationsState(next);
    writeAppearance(ANIMATIONS_STORAGE_KEY, next);
  }, []);

  return { accent, animations, setAccent, setAnimations };
}
