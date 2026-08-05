"use client";

import { useId } from "react";
import type { CSSProperties } from "react";

export interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  displayValue?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
}: SliderProps) {
  const inputId = useId();
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      {label !== undefined && (
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
          {displayValue !== undefined && (
            <span className="text-sm font-semibold tabular-nums text-ink">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={displayValue}
        style={{ "--slider-fill": `${fill}%` } as CSSProperties}
        className="slider-premium h-2 w-full cursor-pointer"
      />
    </div>
  );
}
