"use client";

import type { InputHTMLAttributes } from "react";
import { SearchIcon } from "./icons";

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  className?: string;
}

export function SearchBar({ className = "", ...rest }: SearchBarProps) {
  return (
    <div className={`relative w-full sm:w-[420px] ${className}`}>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        className="h-12 w-full rounded-md border border-border bg-surface pl-11 pr-4 text-input text-ink transition-[border-color,box-shadow] duration-150 ease-premium placeholder:text-muted focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none"
        {...rest}
      />
    </div>
  );
}
