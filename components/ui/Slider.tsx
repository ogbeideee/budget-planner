"use client";

import { useId } from "react";

export interface SliderProps {
  label: string;
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
  return (
    <div className="flex flex-col gap-1.5">
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
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={displayValue}
        className="h-11 w-full cursor-pointer accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      />
    </div>
  );
}
