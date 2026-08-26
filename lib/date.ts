import type { Month } from "./types";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMonth(value: string): value is Month {
  return MONTH_RE.test(value);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const date = isoToDate(value);
  return dateToIso(date) === value;
}

export function monthKey(year: number, monthIndex: number): Month {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function parseMonth(month: Month): { year: number; monthIndex: number } {
  if (!isMonth(month)) throw new Error(`Invalid month key: ${month}`);
  return {
    year: Number(month.slice(0, 4)),
    monthIndex: Number(month.slice(5, 7)) - 1,
  };
}

export function currentMonthKey(): Month {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth());
}

export function monthOffset(month: Month, delta: number): Month {
  const { year, monthIndex } = parseMonth(month);
  const date = new Date(year, monthIndex + delta, 1);
  return monthKey(date.getFullYear(), date.getMonth());
}

export function todayIso(): string {
  return dateToIso(new Date());
}

/**
 * Default date for a new transaction while a screen is viewing `month`.
 * Today when today falls inside the month (so new records default to "now"),
 * otherwise the first of the viewed month. A transaction's calendar date —
 * never the current date — decides which planner month it belongs to, so the
 * default stays inside `month`'s start/end boundaries even when the user is
 * working in a past or future month.
 */
export function defaultDateForMonth(month: Month): string {
  const today = todayIso();
  return monthKeyFromIso(today) === month ? today : `${month}-01`;
}

export function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isoToDate(iso: string): Date {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7)) - 1;
  const day = Number(iso.slice(8, 10));
  return new Date(year, month, day);
}

export function monthKeyFromIso(iso: string): Month {
  return iso.slice(0, 7);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampDay(year: number, monthIndex: number, day: number): number {
  return Math.min(day, daysInMonth(year, monthIndex));
}

export function nextMonthDate(iso: string): string {
  const date = isoToDate(iso);
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const day = clampDay(next.getFullYear(), next.getMonth(), date.getDate());
  return dateToIso(new Date(next.getFullYear(), next.getMonth(), day));
}

export function weekdayOfIso(iso: string): number {
  return isoToDate(iso).getDay();
}

export function datesInMonthByWeekday(month: Month, weekday: number): Date[] {
  const { year, monthIndex } = parseMonth(month);
  const total = daysInMonth(year, monthIndex);
  const result: Date[] = [];
  for (let day = 1; day <= total; day += 1) {
    const date = new Date(year, monthIndex, day);
    if (date.getDay() === weekday) result.push(date);
  }
  return result;
}

export function formatMonthLabel(month: Month): string {
  const { year, monthIndex } = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatMonthShort(month: Month): string {
  const { year, monthIndex } = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function formatDateShort(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Local "9:14 AM" time for a full ISO datetime (e.g. a record's createdAt).
 * Returns "" for an empty/missing/invalid value so callers can fall back to "—".
 */
export function formatTime(value: string): string {
  if (value === "") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Aug 15, 2026 · 9:14 AM" for a full ISO datetime; "" when missing/invalid. */
export function formatDateTime(value: string): string {
  if (value === "") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = formatTime(value);
  return timePart === "" ? datePart : `${datePart} · ${timePart}`;
}

export function daysBetween(isoA: string, isoB: string): number {
  const a = isoToDate(isoA);
  const b = isoToDate(isoB);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}
