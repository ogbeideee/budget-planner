"use client";

import { useId, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  autoGrow?: boolean;
}

export function Textarea({
  label,
  error,
  autoGrow = true,
  id,
  className = "",
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={textareaId} className="text-label font-semibold text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onInput={autoGrow ? grow : undefined}
        className="min-h-[120px] rounded-md border border-border bg-surface px-4 py-3 text-input leading-6 text-ink transition-[border-color,box-shadow] duration-150 ease-premium placeholder:text-muted focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none"
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
