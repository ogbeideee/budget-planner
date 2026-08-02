"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Select } from "@/components/ui/Select";
import type { SortDirection, TransactionSort, TransactionSortKey } from "@/lib/selectors";
import type { CategoryKind, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export interface TransactionFiltersState {
  type: "all" | CategoryKind;
  categoryId: string;
  q: string;
  sort: TransactionSort;
}

export const DEFAULT_SORT: TransactionSort = {
  key: "date",
  direction: "desc",
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "date-desc", label: "Date: newest first" },
  { value: "date-asc", label: "Date: oldest first" },
  { value: "amount-desc", label: "Amount: high to low" },
  { value: "amount-asc", label: "Amount: low to high" },
];

export function parseSort(value: string | null): TransactionSort {
  if (value === "date-asc" || value === "amount-desc" || value === "amount-asc") {
    const [key, direction] = value.split("-") as [
      TransactionSortKey,
      SortDirection,
    ];
    return { key, direction };
  }
  return DEFAULT_SORT;
}

export function serializeSort(sort: TransactionSort): string {
  return `${sort.key}-${sort.direction}`;
}

export function sortIsDefault(sort: TransactionSort): boolean {
  return serializeSort(sort) === serializeSort(DEFAULT_SORT);
}

export interface TransactionFiltersProps {
  month: Month;
  onMonthChange: (month: Month) => void;
  filters: TransactionFiltersState;
  onChange: (filters: TransactionFiltersState) => void;
  onClear: () => void;
}

export function TransactionFilters({
  month,
  onMonthChange,
  filters,
  onChange,
  onClear,
}: TransactionFiltersProps) {
  const categories = useAppStore((s) => s.state.categories);
  const hasFilters =
    filters.type !== "all" ||
    filters.categoryId !== "all" ||
    filters.q !== "" ||
    !sortIsDefault(filters.sort);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <MonthPicker value={month} onChange={onMonthChange} />
      <Select
        label="Type"
        options={[
          { value: "all", label: "All types" },
          { value: "income", label: "Income" },
          { value: "expense", label: "Expense" },
        ]}
        value={filters.type}
        onChange={(event) =>
          onChange({
            ...filters,
            type: event.target.value as TransactionFiltersState["type"],
          })
        }
      />
      <Select
        label="Category"
        options={[
          { value: "all", label: "All categories" },
          ...categories.map((category) => ({
            value: category.id,
            label: `${category.icon} ${category.name}`,
          })),
        ]}
        value={filters.categoryId}
        onChange={(event) => onChange({ ...filters, categoryId: event.target.value })}
      />
      <Select
        label="Sort"
        options={SORT_OPTIONS}
        value={serializeSort(filters.sort)}
        onChange={(event) => onChange({ ...filters, sort: parseSort(event.target.value) })}
      />
      <div className="min-w-52 flex-1">
        <Input
          label="Search"
          placeholder="Search notes…"
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
