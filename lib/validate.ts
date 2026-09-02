import { isMonth, isIsoDate, monthKeyFromIso, monthOffset } from "./date";
import { createId } from "./ids";
import { BADGES } from "./streak";
import type {
  AppState,
  Budget,
  Category,
  CategoryKind,
  Currency,
  Debt,
  EarnedBadge,
  FutureExpense,
  FutureExpenseStatus,
  ID,
  ImportProvenance,
  IncomePlan,
  LearnedRule,
  Priority,
  RecurrenceFrequency,
  RecurrenceRule,
  RolloverRecord,
  Theme,
  Transaction,
} from "./types";

/** Badge ids the current release defines. A saved badge outside this set was
 *  retired in a later version and is dropped on load rather than failing it. */
const KNOWN_BADGE_IDS = new Set(BADGES.map((badge) => badge.id));

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

const IMPORT_BANKS = ["gtco", "opay", "kuda", "palmpay", "owealth", "other", "unknown"] as const;

/** Validates statement-import provenance (Prompt 5A). Optional on
 *  Transaction; when present every string must be capped and the shape must
 *  be exact so re-import detection stays reliable. */
function validateImportSource(value: unknown): Transaction["importSource"] {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new ValidationError("Invalid transaction.importSource");
  if (value.source !== "statement-import") {
    throw new ValidationError("Invalid transaction.importSource.source");
  }
  if (typeof value.bank !== "string" || !IMPORT_BANKS.includes(value.bank as never)) {
    throw new ValidationError("Invalid transaction.importSource.bank");
  }
  const optional = (raw: unknown, field: string): string | undefined => {
    if (raw === undefined || raw === null) return undefined;
    const str = requireString(raw, `transaction.importSource.${field}`);
    if (str.length === 0 || str.length > MAX_NOTE_LENGTH) {
      throw new ValidationError(
        `Invalid transaction.importSource.${field}: length out of range`,
      );
    }
    return str;
  };
  return {
    source: "statement-import",
    bank: value.bank as ImportProvenance["bank"],
    reference: optional(value.reference, "reference"),
    originalDescription: optional(value.originalDescription, "originalDescription"),
    statementDate: optional(value.statementDate, "statementDate"),
  };
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
    // Opt-in and absent by default: only an explicit `true` turns it on, so a
    // state written before rollover existed stays exactly as it was.
    rollover: value.rollover === true ? true : undefined,
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
    importSource: validateImportSource(value.importSource),
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

/** Validates a learned classification rule (Prompt 6A): ids/keys are capped
 *  and non-empty, the signal kind is exact, the target category must still
 *  exist, and strength is a positive integer. */
function validateLearnedRule(value: unknown, categories: Category[]): LearnedRule {
  if (!isRecord(value)) throw new ValidationError("Invalid learned rule");
  const categoryId = requireNonEmptyString(value.categoryId, "learnedRule.categoryId");
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new ValidationError("Invalid learnedRule.categoryId: unknown category");
  }
  if (value.kind !== "provider" && value.kind !== "merchant" && value.kind !== "description") {
    throw new ValidationError("Invalid learnedRule.kind");
  }
  const strength = value.strength;
  if (typeof strength !== "number" || !Number.isInteger(strength) || strength < 1) {
    throw new ValidationError("Invalid learnedRule.strength");
  }
  return {
    id: requireNonEmptyString(value.id, "learnedRule.id"),
    source: "statement-import",
    kind: value.kind,
    key: requireNonEmptyString(value.key, "learnedRule.key"),
    categoryId,
    strength,
    enabled: value.enabled === undefined || value.enabled === null
      ? false
      : Boolean(value.enabled),
    createdAt: requireString(value.createdAt, "learnedRule.createdAt"),
    updatedAt: requireString(value.updatedAt, "learnedRule.updatedAt"),
    // Absent on every rule written before usage tracking existed.
    lastUsedAt:
      value.lastUsedAt === undefined || value.lastUsedAt === null
        ? undefined
        : requireString(value.lastUsedAt, "learnedRule.lastUsedAt"),
  };
}

/** Validates one persisted carryover record. Amounts are non-negative (an
 *  overspent month carries nothing — never a debt), `amount` never exceeds the
 *  cap that was recorded with it, and `fromMonth` must really be the month
 *  before `month`. A record whose category no longer exists is dropped by the
 *  caller rather than failing the whole state. */
function validateRolloverRecord(value: unknown): RolloverRecord {
  if (!isRecord(value)) throw new ValidationError("Invalid rollover");
  const month = requireString(value.month, "rollover.month");
  if (!isMonth(month)) throw new ValidationError("Invalid rollover.month");
  const fromMonth = requireString(value.fromMonth, "rollover.fromMonth");
  if (!isMonth(fromMonth)) throw new ValidationError("Invalid rollover.fromMonth");
  if (monthOffset(month, -1) !== fromMonth) {
    throw new ValidationError("Invalid rollover.fromMonth: not the prior month");
  }
  const nonNegative = (raw: unknown, label: string): number => {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      throw new ValidationError(`Invalid ${label}`);
    }
    return raw;
  };
  const cap = nonNegative(value.cap, "rollover.cap");
  const amount = nonNegative(value.amount, "rollover.amount");
  if (amount > cap) throw new ValidationError("Invalid rollover.amount: exceeds cap");
  return {
    id: requireNonEmptyString(value.id, "rollover.id"),
    categoryId: requireNonEmptyString(value.categoryId, "rollover.categoryId"),
    month,
    fromMonth,
    amount,
    leftover: nonNegative(value.leftover, "rollover.leftover"),
    cap,
    computedAt: requireString(value.computedAt, "rollover.computedAt"),
  };
}

/** Validates one debt record (FR-20). Amounts are non-negative integers in
 *  minor units and the rate is non-negative integer basis points — 0 is
 *  explicitly valid (interest-free loans). A record whose category no longer
 *  exists, or a second record for a category that already has one, is dropped
 *  by the caller rather than failing the whole state. */
function validateDebt(value: unknown): Debt {
  if (!isRecord(value)) throw new ValidationError("Invalid debt");
  const amount = (raw: unknown, label: string): number => {
    if (
      typeof raw !== "number" ||
      !Number.isFinite(raw) ||
      !Number.isInteger(raw) ||
      raw < 0
    ) {
      throw new ValidationError(`Invalid ${label}`);
    }
    return raw;
  };
  const balance = amount(value.balance, "debt.balance");
  return {
    id: requireNonEmptyString(value.id, "debt.id"),
    categoryId: requireNonEmptyString(value.categoryId, "debt.categoryId"),
    balance,
    // Older/hand-edited records may omit it; the current balance is the only
    // sane stand-in, and it is display-only so it cannot skew a projection.
    startingBalance:
      value.startingBalance === undefined || value.startingBalance === null
        ? balance
        : amount(value.startingBalance, "debt.startingBalance"),
    aprBps: amount(value.aprBps, "debt.aprBps"),
    minimumPayment: amount(value.minimumPayment, "debt.minimumPayment"),
    createdAt: requireString(value.createdAt, "debt.createdAt"),
    updatedAt: requireString(value.updatedAt, "debt.updatedAt"),
  };
}

/** Validates one earned badge (FR-21). Unknown ids are dropped rather than
 *  rejected: a badge removed from `BADGES` in a later release must not make an
 *  existing save unreadable. Duplicates are dropped for the same reason a
 *  duplicate debt is — the view would list the achievement twice. */
function validateEarnedBadge(value: unknown): EarnedBadge {
  if (!isRecord(value)) throw new ValidationError("Invalid badge");
  const badgeValue = value.value;
  if (
    typeof badgeValue !== "number" ||
    !Number.isFinite(badgeValue) ||
    badgeValue < 0
  ) {
    throw new ValidationError("Invalid badge.value");
  }
  return {
    id: requireNonEmptyString(value.id, "badge.id"),
    earnedAt: requireString(value.earnedAt, "badge.earnedAt"),
    value: badgeValue,
  };
}

export function validateAppState(value: unknown): AppState {
  if (!isRecord(value)) throw new ValidationError("Invalid state");
  if (
    value.version !== 1 &&
    value.version !== 2 &&
    value.version !== 3 &&
    value.version !== 4 &&
    value.version !== 5 &&
    value.version !== 6 &&
    value.version !== 7 &&
    value.version !== 8 &&
    value.version !== 9 &&
    value.version !== 10
  ) {
    throw new ValidationError("Unsupported state version");
  }
  const migrated = migrateV9(
    migrateV8(
      migrateV7(
        migrateV6(migrateV5(migrateV4(migrateV3(migrateV2(migrateV1(value)))))),
      ),
    ),
  );
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
  const learnedRules =
    migrated.learnedRules === undefined || migrated.learnedRules === null
      ? []
      : requireArray(migrated.learnedRules, "learnedRules").map((entry) =>
          validateLearnedRule(entry, categories),
        );
  const knownCategory = new Set(categories.map((category) => category.id));
  const rollovers =
    migrated.rollovers === undefined || migrated.rollovers === null
      ? []
      : requireArray(migrated.rollovers, "rollovers")
          .map((entry) => validateRolloverRecord(entry))
          // A deleted category leaves its carryover records orphaned; drop
          // them rather than rejecting the whole state.
          .filter((record) => knownCategory.has(record.categoryId));
  const seenDebtCategory = new Set<string>();
  const debts =
    migrated.debts === undefined || migrated.debts === null
      ? []
      : requireArray(migrated.debts, "debts")
          .map((entry) => validateDebt(entry))
          // One debt per category, and none without a category: a deleted
          // category leaves its debt orphaned, and a duplicate would make the
          // payoff engine count the same obligation twice.
          .filter((debt) => {
            if (!knownCategory.has(debt.categoryId)) return false;
            if (seenDebtCategory.has(debt.categoryId)) return false;
            seenDebtCategory.add(debt.categoryId);
            return true;
          });
  const seenBadge = new Set<string>();
  const badges =
    migrated.badges === undefined || migrated.badges === null
      ? []
      : requireArray(migrated.badges, "badges")
          .map((entry) => validateEarnedBadge(entry))
          .filter((badge) => {
            // An id retired from BADGES in a later release, or a duplicate,
            // is dropped rather than failing the load or showing twice.
            if (!KNOWN_BADGE_IDS.has(badge.id)) return false;
            if (seenBadge.has(badge.id)) return false;
            seenBadge.add(badge.id);
            return true;
          });
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
  // Display preference only; anything unrecognised falls back to avalanche
  // (the strategy that costs the least), never an error.
  const debtStrategy =
    settings.debtStrategy === "snowball" ? "snowball" : "avalanche";
  // Opt-in (FR-26). Anything but an explicit `true` means off, so a state
  // that predates the field — or carries junk in it — keeps the close-to-quit
  // behaviour rather than silently acquiring a background process.
  const backgroundMode = settings.backgroundMode === true;
  return {
    version: 10,
    categories,
    budgets,
    transactions,
    futureExpenses,
    recurrenceRules,
    incomePlans,
    learnedRules,
    rollovers,
    debts,
    badges,
    settings: {
      currency,
      recurringEnabled: settings.recurringEnabled,
      firstRunDone: settings.firstRunDone,
      theme,
      debtStrategy,
      backgroundMode,
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

function migrateV3(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 3) return value;
  return { ...value, version: 4, learnedRules: [] };
}

/**
 * v4 → v5: one-time correction of two category icons that never matched what
 * the category represents — "Edi" (data/airtime top-ups) carried a plant and
 * "Essentials" carried a gift. Applied ONCE by name (case-insensitive) and only
 * when the wrong icon is still in place, so a user who has since picked their
 * own icon keeps it and can freely change these two afterwards.
 */
// `from` lists every icon we treat as "still the wrong one". Essentials
// includes 🏪 (the store glyph actually on file) as well as 🎁, and it moves to
// the basket rather than the cart because "Misc" already owns 🛒 and must not
// change — two identical icons in one list would be worse than the mismatch.
const V5_ICON_FIXES: ReadonlyArray<IconFix> = [
  { name: "edi", from: ["🌱", "🌳", "🌲", "🪴", "🌿"], to: "📶" },
  { name: "essentials", from: ["🎁", "🏪"], to: "🧺" },
];

interface IconFix {
  name: string;
  from: readonly string[];
  to: string;
}

/**
 * Rewrite category icons ONCE, matched on lowercase name AND the specific
 * wrong icon, so a category the user has since re-iconed keeps their choice
 * and every one of them stays freely editable afterwards.
 */
function applyIconFixes(
  value: Record<string, unknown>,
  fixes: ReadonlyArray<IconFix>,
  nextVersion: number,
): Record<string, unknown> {
  const categories = Array.isArray(value.categories)
    ? value.categories.map((entry) => {
        if (!isRecord(entry)) return entry;
        const name = typeof entry.name === "string" ? entry.name.toLowerCase() : "";
        const icon = typeof entry.icon === "string" ? entry.icon : "";
        const fix = fixes.find(
          (candidate) =>
            candidate.name === name && candidate.from.includes(icon),
        );
        return fix ? { ...entry, icon: fix.to } : entry;
      })
    : value.categories;
  return { ...value, version: nextVersion, categories };
}

function migrateV4(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 4) return value;
  return applyIconFixes(value, V5_ICON_FIXES, 5);
}

/**
 * v5 -> v6: second icon audit. Three categories carried an icon that a new
 * user would misread — "Loan" on a piggy bank (reads as savings, and was the
 * same glyph as Salary), "Misc" on a shopping cart (reads as groceries), and
 * "internet" on a light bulb (reads as electricity). Corrected to a repayment,
 * a box and a globe from the expanded icon library.
 */
const V6_ICON_FIXES: ReadonlyArray<IconFix> = [
  { name: "loan", from: ["💰", "🪙"], to: "💸" },
  { name: "misc", from: ["🛒"], to: "📦" },
  { name: "internet", from: ["💡", "⚡"], to: "🌐" },
];

function migrateV5(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 5) return value;
  return applyIconFixes(value, V6_ICON_FIXES, 6);
}

/**
 * v6 -> v7: rollover budgets. Backfills the empty `rollovers` history only.
 *
 * Deliberately does NOT set `rollover` on any category: the feature is opt-in
 * per category and enabling it must always be an explicit user action, so
 * every existing budget keeps behaving exactly as it did. It also writes no
 * carryover records for months already in the ledger — inventing history for
 * months the user never opted into would hand them limits they never had.
 */
function migrateV6(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 6) return value;
  return { ...value, version: 7, rollovers: [] };
}

/**
 * v7 -> v8: debt payoff planning (FR-20). Backfills the empty `debts` array
 * and the `debtStrategy` display preference.
 *
 * Flags NO category as debt: tracking one is an explicit user action, and
 * guessing from a category's name ("Loan", "Card") would invent balances and
 * interest rates the user never entered. Every existing category keeps
 * behaving exactly as it did.
 */
/**
 * v8 -> v9: savings streaks and badges (FR-21). Backfills the empty `badges`
 * list only.
 *
 * Awards NOTHING retroactively: the streak itself is derived from the ledger
 * on every read, so an existing user's history is recognised the first time
 * the app evaluates badges — no migration needs to invent earned records, and
 * inventing them would risk crediting achievements the data does not support.
 */
/**
 * v9 -> v10: tray + background mode (FR-26). Backfills
 * `settings.backgroundMode` as `false`.
 *
 * Opts NOBODY in, per the rule every migration here follows. Background mode
 * changes what the window's close button does — an existing user who upgrades
 * must keep getting a quit, and must choose the new behaviour deliberately in
 * Settings. Backfilling `true` would leave a process running behind the backs
 * of users who never asked for one.
 */
function migrateV9(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 9) return value;
  const settings = isRecord(value.settings) ? value.settings : {};
  return {
    ...value,
    version: 10,
    settings: { ...settings, backgroundMode: false },
  };
}

function migrateV8(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 8) return value;
  return { ...value, version: 9, badges: [] };
}

function migrateV7(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 7) return value;
  const settings = isRecord(value.settings) ? value.settings : {};
  return {
    ...value,
    version: 8,
    debts: [],
    settings: { ...settings, debtStrategy: "avalanche" },
  };
}
