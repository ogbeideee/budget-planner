import { isMonth, isIsoDate } from "./date";
import type {
  AppState,
  Budget,
  Category,
  CategoryKind,
  Currency,
  ID,
  Priority,
  RecurrenceFrequency,
  RecurrenceRule,
  Theme,
  Transaction,
} from "./types";

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_NOTE_LENGTH = 200;

export class ValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new ValidationError(`Invalid ${field}`);
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  const str = requireString(value, field);
  if (str.length === 0) throw new ValidationError(`Invalid ${field}: empty`);
  return str;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(`Invalid ${field}`);
  return value;
}

function requireKind(value: unknown, field: string): CategoryKind {
  if (value !== "income" && value !== "expense") {
    throw new ValidationError(`Invalid ${field}`);
  }
  return value;
}

function requireOptionalNote(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const note = requireString(value, "note");
  if (note.length > MAX_NOTE_LENGTH) {
    throw new ValidationError(`Invalid note: longer than ${MAX_NOTE_LENGTH} chars`);
  }
  return note;
}

function validateCategory(value: unknown): Category {
  if (!isRecord(value)) throw new ValidationError("Invalid category");
  const kind = requireKind(value.kind, "category.kind");
  const color = requireString(value.color, "category.color");
  if (!COLOR_RE.test(color)) throw new ValidationError("Invalid category.color");
  const category: Category = {
    id: requireNonEmptyString(value.id, "category.id"),
    name: requireNonEmptyString(value.name, "category.name"),
    icon: requireNonEmptyString(value.icon, "category.icon"),
    color,
    kind,
    createdAt: requireString(value.createdAt, "category.createdAt"),
  };
  return category;
}

function validateBudget(value: unknown, categories: Category[]): Budget {
  if (!isRecord(value)) throw new ValidationError("Invalid budget");
  const categoryId = requireNonEmptyString(value.categoryId, "budget.categoryId");
  const category = categories.find((c) => c.id === categoryId);
  if (!category) throw new ValidationError("Invalid budget.categoryId: unknown category");
  if (category.kind !== "expense") {
    throw new ValidationError("Invalid budget.categoryId: category must be an expense");
  }
  const month = requireString(value.month, "budget.month");
  if (!isMonth(month)) throw new ValidationError("Invalid budget.month");
  const limit = value.limit;
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0) {
    throw new ValidationError("Invalid budget.limit");
  }
  let priority: Priority = "medium";
  if (value.priority !== undefined && value.priority !== null) {
    if (value.priority !== "high" && value.priority !== "medium" && value.priority !== "low") {
      throw new ValidationError("Invalid budget.priority");
    }
    priority = value.priority;
  }
  return {
    id: requireNonEmptyString(value.id, "budget.id"),
    categoryId,
    month,
    limit,
    priority,
  };
}

function validateTransaction(value: unknown, categories: Category[]): Transaction {
  if (!isRecord(value)) throw new ValidationError("Invalid transaction");
  const categoryId = requireNonEmptyString(
    value.categoryId,
    "transaction.categoryId",
  );
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new ValidationError("Invalid transaction.categoryId: unknown category");
  }
  const type = requireKind(value.type, "transaction.type");
  if (type !== category.kind) {
    throw new ValidationError("Invalid transaction.type: does not match category");
  }
  const monthlyIncome =
    value.monthlyIncome === undefined || value.monthlyIncome === null
      ? undefined
      : Boolean(value.monthlyIncome);
  if (monthlyIncome && type !== "income") {
    throw new ValidationError("Invalid transaction.monthlyIncome: must be income");
  }
  const amount = value.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("Invalid transaction.amount");
  }
  const date = requireString(value.date, "transaction.date");
  if (!isIsoDate(date)) throw new ValidationError("Invalid transaction.date");
  if (!isMonth(date.slice(0, 7))) throw new ValidationError("Invalid transaction.date");
  return {
    id: requireNonEmptyString(value.id, "transaction.id"),
    categoryId,
    amount,
    type,
    date,
    note: requireOptionalNote(value.note),
    createdAt: requireString(value.createdAt, "transaction.createdAt"),
    recurringRuleId:
      value.recurringRuleId === undefined || value.recurringRuleId === null
        ? undefined
        : requireNonEmptyString(value.recurringRuleId, "transaction.recurringRuleId"),
    edited: value.edited === undefined ? undefined : Boolean(value.edited),
    deferred: value.deferred === undefined ? undefined : Boolean(value.deferred),
    monthlyIncome,
  };
}

function validateRecurrenceRule(
  value: unknown,
  categories: Category[],
): RecurrenceRule {
  if (!isRecord(value)) throw new ValidationError("Invalid recurrence rule");
  const categoryId = requireNonEmptyString(
    value.categoryId,
    "recurrenceRule.categoryId",
  );
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new ValidationError("Invalid recurrenceRule.categoryId: unknown category");
  }
  const type = requireKind(value.type, "recurrenceRule.type");
  if (type !== category.kind) {
    throw new ValidationError("Invalid recurrenceRule.type: does not match category");
  }
  const frequency = requireString(value.frequency, "recurrenceRule.frequency");
  if (
    frequency !== "weekly" &&
    frequency !== "monthly" &&
    frequency !== "yearly"
  ) {
    throw new ValidationError("Invalid recurrenceRule.frequency");
  }
  const amount = value.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("Invalid recurrenceRule.amount");
  }
  const anchorDate = requireString(value.anchorDate, "recurrenceRule.anchorDate");
  if (!isIsoDate(anchorDate)) {
    throw new ValidationError("Invalid recurrenceRule.anchorDate");
  }
  if (typeof value.enabled !== "boolean") {
    throw new ValidationError("Invalid recurrenceRule.enabled");
  }
  if (!isRecord(value.exceptions)) {
    throw new ValidationError("Invalid recurrenceRule.exceptions");
  }
  const exceptions: RecurrenceRule["exceptions"] = {};
  for (const [month, entry] of Object.entries(value.exceptions)) {
    if (!isMonth(month)) throw new ValidationError("Invalid exceptions key");
    if (entry === "skipped") {
      exceptions[month] = "skipped";
    } else if (Array.isArray(entry)) {
      for (const id of entry) {
        if (typeof id !== "string" || id.length === 0) {
          throw new ValidationError("Invalid exceptions entry");
        }
      }
      exceptions[month] = entry as ID[];
    } else {
      throw new ValidationError("Invalid exceptions entry");
    }
  }
  return {
    id: requireNonEmptyString(value.id, "recurrenceRule.id"),
    categoryId,
    amount,
    type,
    frequency: frequency as RecurrenceFrequency,
    anchorDate,
    note: requireOptionalNote(value.note),
    enabled: value.enabled,
    exceptions,
  };
}

export function validateAppState(value: unknown): AppState {
  if (!isRecord(value)) throw new ValidationError("Invalid state");
  if (value.version !== 1) throw new ValidationError("Unsupported state version");
  const categories = requireArray(value.categories, "categories").map(
    (entry) => validateCategory(entry),
  );
  const budgets = requireArray(value.budgets, "budgets").map((entry) =>
    validateBudget(entry, categories),
  );
  const transactions = requireArray(value.transactions, "transactions").map(
    (entry) => validateTransaction(entry, categories),
  );
  const recurrenceRules = requireArray(
    value.recurrenceRules,
    "recurrenceRules",
  ).map((entry) => validateRecurrenceRule(entry, categories));
  const settings = value.settings;
  if (!isRecord(settings)) throw new ValidationError("Invalid settings");
  let currency: Currency = "USD";
  if (settings.currency === "USD" || settings.currency === "NGN") {
    currency = settings.currency;
  } else if (settings.currency !== undefined && settings.currency !== null) {
    throw new ValidationError("Invalid settings.currency");
  } else if (settings.currencySymbol === "₦") {
    currency = "NGN";
  }
  if (typeof settings.recurringEnabled !== "boolean") {
    throw new ValidationError("Invalid settings.recurringEnabled");
  }
  if (typeof settings.firstRunDone !== "boolean") {
    throw new ValidationError("Invalid settings.firstRunDone");
  }
  let theme: Theme = "system";
  if (settings.theme !== undefined && settings.theme !== null) {
    if (settings.theme !== "light" && settings.theme !== "dark" && settings.theme !== "system") {
      throw new ValidationError("Invalid settings.theme");
    }
    theme = settings.theme;
  }
  return {
    version: 1,
    categories,
    budgets,
    transactions,
    recurrenceRules,
    settings: {
      currency,
      recurringEnabled: settings.recurringEnabled,
      firstRunDone: settings.firstRunDone,
      theme,
    },
  };
}
