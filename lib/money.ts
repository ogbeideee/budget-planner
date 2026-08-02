import type { Currency } from "./types";

const SYMBOLS: Record<Currency, string> = {
  USD: "$",
  NGN: "₦",
};

const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

export function currencySymbol(currency: Currency): string {
  return SYMBOLS[currency];
}

export function toMinorUnits(input: string, _currency?: Currency): number {
  let cleaned = input.trim();
  for (const symbol of Object.values(SYMBOLS)) {
    cleaned = cleaned.replace(symbol, "").trim();
  }
  if (cleaned === "" || !DECIMAL_RE.test(cleaned)) return NaN;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function isMinorUnitsValid(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function formatMoney(minor: number, currency: Currency): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const padded = String(abs).padStart(3, "0");
  const whole = padded.slice(0, -2) || "0";
  const fraction = padded.slice(-2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${SYMBOLS[currency]}${grouped}.${fraction}`;
}

export function minorToInput(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const padded = String(Math.abs(minor)).padStart(3, "0");
  const whole = padded.slice(0, -2) || "0";
  const fraction = padded.slice(-2);
  return fraction === "00" ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

export function compactMoney(minor: number, currency: Currency): string {
  const symbol = SYMBOLS[currency];
  const sign = minor < 0 ? "-" : "";
  const digits = String(Math.abs(minor)).padStart(3, "0");
  const whole = digits.slice(0, -2);
  if (whole.length >= 7) {
    return `${sign}${symbol}${whole.slice(0, -6)}.${whole.slice(-6, -5)}M`;
  }
  if (whole.length >= 4) {
    return `${sign}${symbol}${whole.slice(0, -3)}.${whole.slice(-3, -2)}K`;
  }
  return formatMoney(minor, currency);
}
