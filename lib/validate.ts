import { isMonth, isIsoDate, monthKeyFromIso } from "./date";
import { createId } from "./ids";
import type {
  AppState,
  Budget,
  Category,
  CategoryKind,
  Currency,
  FutureExpense,
  FutureExpenseStatus,
  ID,
  IncomePlan,
  Priority,
  RecurrenceFrequency,
  RecurrenceRule,
  Theme,
  Transaction,
} from "./types";

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const MAX_NOTE_LENGTH = 200;
export const MAX_TITLE_LENGTH = 60;
export const MAX_CATEGORY_NAME = 30;

export function isHexColor(value: string): boolean {
  return COLOR_RE.test(value);
}

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

function validateFutureExpense(
  value: unknown,
  categories: Category[],
): FutureExpense {
  if (!isRecord(value)) throw new ValidationError("Invalid future expense");
  const categoryId = requireNonEmptyString(
    value.categoryId,
    "futureExpense.categoryId",
  );
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new ValidationError("Invalid futureExpense.categoryId: unknown category");
  }
  if (category.kind !== "expense") {
    throw new ValidationError(
      "Invalid futureExpense.categoryId: category must be an expense",
    );
  }
  const title = requireNonEmptyString(value.title, "futureExpense.title");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Invalid futureExpense.title: longer than ${MAX_TITLE_LENGTH} chars`);
  }
  const amount = value.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("Invalid futureExpense.amount");
  }
  const dueDate = requireString(value.dueDate, "futureExpense.dueDate");
  if (!isIsoDate(dueDate)) throw new ValidationError("Invalid futureExpense.dueDate");
  let priority: Priority = "medium";
  if (value.priority !== undefined && value.priority !== null) {
    if (value.priority !== "high" && value.priority !== "medium" && value.priority !== "low") {
      throw new ValidationError("Invalid futureExpense.priority");
    }
    priority = value.priority;
  }
  let status: FutureExpenseStatus = "upcoming";
  if (value.status === undefined || value.status === null) {
    status = "upcoming";
  } else if (value.status === "upcoming" || value.status === "paid") {
    status = value.status;
  } else {
    throw new ValidationError("Invalid futureExpense.status");
  }
  return {
    id: requireNonEmptyString(value.id, "futureExpense.id"),
    categoryId,
    amount,
    title,
    dueDate,
    notes: requireOptionalNote(value.notes),
    recurring:
      value.recurring === undefined || value.recurring === null
        ? false
        : Boolean(value.recurring),
    priority,
    status,
    createdAt: requireString(value.createdAt, "futureExpense.createdAt"),
  };
}

export function validateAppState(value: unknown): AppState {
  if (!isRecord(value)) throw new ValidationError("Invalid state");
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) {
    throw new ValidationError("Unsupported state version");
  }
  const migrated = migrateV2(migrateV1(value));
  const categories = requireArray(migrated.categories, "categories").map(
    (entry) => validateCategory(entry),
  );
  const budgets = requireArray(migrated.budgets, "budgets").map((entry) =>
    validateBudget(entry, categories),
  );
  const transactions = requireArray(migrated.transactions, "transactions").map(
    (entry) => validateTransaction(entry, categories),
  );
  const futureExpenses =
    migrated.futureExpenses === undefined || migrated.futureExpenses === null
      ? []
      : requireArray(migrated.futureExpenses, "futureExpenses").map((entry) =>
          validateFutureExpense(entry, categories),
        );
  const recurrenceRules = requireArray(
    migrated.recurrenceRules,
    "recurrenceRules",
  ).map((entry) => validateRecurrenceRule(entry, categories));
  const incomePlans =
    migrated.incomePlans === undefined || migrated.incomePlans === null
      ? []
      : requireArray(migrated.incomePlans, "incomePlans").map((entry) =>
          validateIncomePlan(entry, categories, transactions),
        );
  const settings = migrated.settings;
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
    version: 3,
    categories,
    budgets,
    transactions,
    futureExpenses,
    recurrenceRules,
    incomePlans,
    settings: {
      currency,
      recurringEnabled: settings.recurringEnabled,
      firstRunDone: settings.firstRunDone,
      theme,
    },
  };
}

function requireAmount(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return value;
}

function validateIncomePlan(
  value: unknown,
  categories: Category[],
  transactions: Transaction[],
): IncomePlan {
  if (!isRecord(value)) throw new ValidationError("Invalid income plan");
  const month = requireString(value.month, "incomePlan.month");
  if (!isMonth(month)) throw new ValidationError("Invalid incomePlan.month");
  const legacy = typeof value.categoryId === "string";
  if (legacy) {
    const category = categories.find((c) => c.id === value.categoryId);
    if (!category || category.kind !== "income") {
      throw new ValidationError("Invalid incomePlan.categoryId: unknown category");
    }
    const received = Math.round(
      transactions
        .filter(
          (t) =>
            t.type === "income" &&
            t.categoryId === category.id &&
            monthKeyFromIso(t.date) === month,
        )
        .reduce((sum, t) => sum + t.amount, 0),
    );
    return {
      id: requireNonEmptyString(value.id, "incomePlan.id"),
      month,
      name: category.name,
      icon: category.icon,
      expectedAmount: requireAmount(
        value.expected,
        "incomePlan.expected",
      ),
      receivedAmount: requireAmount(received, "incomePlan.received"),
    };
  }
  const name = requireNonEmptyString(value.name, "incomePlan.name").trim();
  if (name.length === 0) throw new ValidationError("Invalid incomePlan.name");
  return {
    id: requireNonEmptyString(value.id, "incomePlan.id"),
    month,
    name,
    icon: requireString(value.icon, "incomePlan.icon"),
    expectedAmount: requireAmount(
      value.expectedAmount,
      "incomePlan.expectedAmount",
    ),
    receivedAmount: requireAmount(
      value.receivedAmount,
      "incomePlan.receivedAmount",
    ),
  };
}

const STANDARD_INCOME_CATEGORIES: ReadonlyArray<{
  name: string;
  icon: string;
  color: string;
}> = [
  { name: "Salary", icon: "💰", color: "#0ea5e9" },
  { name: "Business", icon: "🏪", color: "#8b5cf6" },
  { name: "Freelancing", icon: "💻", color: "#14b8a6" },
  { name: "Forex", icon: "💱", color: "#f59e0b" },
  { name: "Bonus", icon: "🎁", color: "#ec4899" },
  { name: "Rental Income", icon: "🏘️", color: "#22c55e" },
];

function makeId(): string {
  return createId();
}

function migrateV1(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 1) return value;
  const categories = requireArray(value.categories, "categories") as Array<
    Record<string, unknown>
  >;
  const transactions = requireArray(
    value.transactions,
    "transactions",
  ) as Array<Record<string, unknown>>;

  const incomeCount = categories.filter(
    (category) => category.kind === "income",
  ).length;
  const knownNames = new Set(
    categories.map((category) =>
      String(category.name ?? "").toLowerCase().trim(),
    ),
  );
  let nextCategories = categories;
  if (incomeCount < 3) {
    const additions: Array<Record<string, unknown>> = [];
    const now = new Date().toISOString();
    for (const standard of STANDARD_INCOME_CATEGORIES) {
      if (knownNames.has(standard.name.toLowerCase())) continue;
      additions.push({
        id: makeId(),
        name: standard.name,
        icon: standard.icon,
        color: standard.color,
        kind: "income",
        createdAt: now,
      });
    }
    nextCategories = [...categories, ...additions];
  }

  const plans: Record<string, unknown>[] = [];
  const seen = new Map<string, Record<string, unknown>>();
  for (const transaction of transactions) {
    if (transaction.monthlyIncome !== true || transaction.type !== "income") {
      continue;
    }
    const month = String(transaction.date ?? "").slice(0, 7);
    const categoryId = String(transaction.categoryId ?? "");
    if (!isMonth(month) || categoryId.length === 0) continue;
    seen.set(`${month}:${categoryId}`, {
      id: makeId(),
      month,
      categoryId,
      expected: Math.round(Number(transaction.amount) || 0),
    });
  }
  for (const plan of seen.values()) plans.push(plan);

  return {
    ...value,
    version: 2,
    categories: nextCategories,
    incomePlans: plans,
  };
}

function migrateV2(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 2) return value;
  const categories =
    value.categories === undefined || value.categories === null
      ? []
      : (requireArray(value.categories, "categories") as Array<
          Record<string, unknown>
        >);
  const transactions =
    value.transactions === undefined || value.transactions === null
      ? []
      : (requireArray(value.transactions, "transactions") as Array<
          Record<string, unknown>
        >);
  const receivedByKey = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "income") continue;
    const month = String(transaction.date ?? "").slice(0, 7);
    const categoryId = String(transaction.categoryId ?? "");
    if (!isMonth(month) || categoryId.length === 0) continue;
    const key = `${month}:${categoryId}`;
    receivedByKey.set(
      key,
      (receivedByKey.get(key) ?? 0) + (Number(transaction.amount) || 0),
    );
  }
  const plans =
    value.incomePlans === undefined || value.incomePlans === null
      ? []
      : (requireArray(value.incomePlans, "incomePlans") as Array<
          Record<string, unknown>
        >);
  const incomePlans = plans.map((plan) => {
    if (typeof plan.name === "string") return plan;
    const categoryId = String(plan.categoryId ?? "");
    const category = categories.find((c) => String(c.id) === categoryId);
    const month = String(plan.month ?? "");
    const { categoryId: _categoryId, expected: _expected, ...rest } = plan;
    return {
      ...rest,
      name: category ? String(category.name ?? "") : "Income",
      icon: category ? String(category.icon ?? "💰") : "💰",
      expectedAmount: Math.round(Number(plan.expected) || 0),
      receivedAmount: Math.round(receivedByKey.get(`${month}:${categoryId}`) ?? 0),
    };
  });
  return { ...value, version: 3, incomePlans };
}
