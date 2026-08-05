import type { AppState, Category } from "./types";

export const DEFAULT_CATEGORIES: ReadonlyArray<Omit<Category, "id" | "createdAt">> = [
  { name: "Rent", icon: "🏠", color: "#ef4444", kind: "expense" },
  { name: "Groceries", icon: "🛒", color: "#f97316", kind: "expense" },
  { name: "Transport", icon: "🚌", color: "#eab308", kind: "expense" },
  { name: "Utilities", icon: "💡", color: "#22c55e", kind: "expense" },
  { name: "Entertainment", icon: "🎬", color: "#8b5cf6", kind: "expense" },
  { name: "Salary", icon: "💰", color: "#0ea5e9", kind: "income" },
  { name: "Business", icon: "🏪", color: "#8b5cf6", kind: "income" },
  { name: "Freelancing", icon: "💻", color: "#14b8a6", kind: "income" },
  { name: "Forex", icon: "💱", color: "#f59e0b", kind: "income" },
  { name: "Bonus", icon: "🎁", color: "#ec4899", kind: "income" },
  { name: "Rental Income", icon: "🏘️", color: "#22c55e", kind: "income" },
];

export function createInitialState(): AppState {
  const now = new Date().toISOString();
  const categories: Category[] = DEFAULT_CATEGORIES.map((category) => ({
    ...category,
    id: crypto.randomUUID(),
    createdAt: now,
  }));
  return {
    version: 3,
    categories,
    budgets: [],
    transactions: [],
    futureExpenses: [],
    recurrenceRules: [],
    incomePlans: [],
    settings: {
      currency: "USD",
      recurringEnabled: true,
      firstRunDone: true,
      theme: "system",
    },
  };
}
