"use client";

import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

const FIELD =
  "select-premium h-12 rounded-md border border-border bg-surface px-4 text-input text-ink transition-[border-color,box-shadow] duration-150 ease-premium hover:border-input-hover focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none";

export function Select({
  label,
  options,
  error,
  placeholder,
  id,
  className = "",
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;
  const controlledValue = rest.value;
  const isEmptySelection =
    (controlledValue === undefined ||
      controlledValue === null ||
      controlledValue === "") &&
    !options.some((option) => option.value === "");
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={selectId} className="text-label font-semibold text-ink">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={FIELD}
        {...rest}
      >
        {isEmptySelection && (
          <option value="">{placeholder ?? "Select…"}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
