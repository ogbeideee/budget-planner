"use client";

import { useEffect, useRef, useState } from "react";

export const ANIMATED_NUMBER_DURATION = 200;

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
    );
  } catch {
    return false;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate a number toward `target` using requestAnimationFrame. Falls back to
 * jumping straight to the target when motion is reduced or rAF is unavailable.
 */
export function useAnimatedNumber(
  target: number,
  duration: number = ANIMATED_NUMBER_DURATION,
): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      valueRef.current = target;
      if (typeof requestAnimationFrame === "function") {
        const frame = requestAnimationFrame(() => setValue(target));
        return () => cancelAnimationFrame(frame);
      }
      const timeout = window.setTimeout(
        () => setValue(target),
        0,
      );
      return () => window.clearTimeout(timeout);
    }

    const from = valueRef.current;
    if (from === target) return;

    let start: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const next = t >= 1 ? target : from + (target - from) * easeOutCubic(t);
      const display = Math.round(next);
      valueRef.current = display;
      setValue(display);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}