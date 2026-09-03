import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isIsoDate, isMonth, monthKeyFromIso, nextMonthDate } from "@/lib/date";
import { createId } from "@/lib/ids";
import {
  markRulesUsed,
  recordCorrection,
  type RuleCorrectionInput,
} from "@/lib/learnedRules";
import { hasGeneratedInstance, recordException } from "@/lib/recurrence";
import { createInitialState } from "@/lib/seed";
import {
  isWritesEnabled,
  loadBackupSnapshot,
  parseExportPayload,
  parseStoredState,
  setWritesEnabled,
  STORAGE_KEY,
} from "@/lib/storage";
import { getStorageBackend } from "@/lib/storageAdapter";
import {
  isHexColor,
  MAX_CATEGORY_NAME,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
} from "@/lib/validate";
import type {
  AppState,
  Budget,
  BudgetInput,
  Category,
  CategoryDeleteReason,
  CategoryInput,
  FutureExpense,
  FutureExpenseInput,
  ID,
  LearnedRule,
  Month,
  Debt,
  DebtInput,
  EarnedBadge,
  PayoffStrategyPreference,
  RecurrenceRule,
  RecurrenceRuleInput,
  RolloverRecord,
  SavingsPlan,
  SavingsPlanInput,
  SavingsPlanStatus,
  Settings,
  Transaction,
  TransactionInput,
} from "@/lib/types";

const STORE_VERSION = 4;

export interface AppStoreErrors {
  hydrateError: string | null;
  setHydrateError(error: string | null): void;
}

export const useAppStoreErrors = create<AppStoreErrors>()((set) => ({
  hydrateError: null,
  setHydrateError: (error) => set({ hydrateError: error }),
}));

export interface AppStore {
  state: AppState;
  addTransaction(input: TransactionInput): void;
  /** Bulk add (single write) — used by the statement import confirmation. */
  addTransactions(inputs: TransactionInput[]): void;
  updateTransaction(id: ID, patch: Partial<TransactionInput>): void;
  deleteTransaction(id: ID): void;
  moveTransactionToNextMonth(id: ID): void;
  setIncomePlan(
    month: Month,
    id: ID | null,
    patch: {
      name?: string;
      icon?: string;
      expectedAmount?: number;
      receivedAmount?: number;
    },
  ): boolean;
  /** Learns from confirmed classification corrections (Prompt 6A) — one
   *  single write for the whole batch. */
  learnFromCorrections(corrections: RuleCorrectionInput[]): void;
  updateLearnedRule(id: ID, patch: Partial<Pick<LearnedRule, "categoryId" | "enabled">>): void;
  deleteLearnedRule(id: ID): void;
  /** Removes every learned mapping — the Settings "start over" action. */
  clearLearnedRules(): void;
  /** Stamps `lastUsedAt` on rules whose suggestion was actually imported. */
  markLearnedRulesUsed(ids: ID[]): void;
  addBudget(input: BudgetInput): boolean;
  updateBudget(id: ID, patch: Partial<Pick<Budget, "categoryId" | "limit" | "priority">>): void;
  deleteBudget(id: ID): void;
  addFutureExpense(input: FutureExpenseInput): boolean;
  updateFutureExpense(id: ID, patch: Partial<FutureExpenseInput>): void;
  deleteFutureExpense(id: ID): void;
  addCategory(input: CategoryInput): boolean;
  renameCategory(id: ID, name: string): boolean;
  updateCategory(id: ID, patch: Partial<Pick<Category, "name" | "icon" | "color">>): boolean;
  /** Opt one category in or out of rolling unspent funds forward. Explicit
   *  and per category — there is no bulk or global equivalent by design. */
  setCategoryRollover(id: ID, rollover: boolean): void;
  /** Creates or updates the debt record linked to a category (FR-20). One
   *  record per category; passing `null` stops tracking and removes it. */
  setCategoryDebt(categoryId: ID, input: DebtInput | null): void;
  /** Which payoff projection to surface prominently. Display only. */
  setDebtStrategy(strategy: PayoffStrategyPreference): void;
  /** Records badges produced by `newlyEarnedBadges`. Appends only and ignores
   *  any id already held, so an achievement can never be granted twice. */
  grantBadges(badges: EarnedBadge[]): void;
  /** Persists carryover records produced by `computeRollovers`. Appends only,
   *  and ignores any record for a (category, month) already settled, so a
   *  month transition can never be applied twice. */
  applyRollovers(records: RolloverRecord[]): void;
  /** Creates a savings goal (FR-28). Standalone — no category, budget or debt
   *  record is touched. An empty/blank name is rejected silently. */
  addSavingsPlan(input: SavingsPlanInput): void;
  /** Edits the user-facing fields of a plan. Contributions live in the
   *  ledger, never here — progress is always derived. */
  updateSavingsPlan(id: ID, patch: Partial<SavingsPlanInput>): void;
  /** Moves a plan between active/completed/ongoing/archived. Stamps
   *  `completedAt` the first time the plan is closed out, marked ongoing, or
   *  kept open past its target (`stampCompletedAt` — the completion prompt's
   *  "keep contributing" answer). */
  setSavingsPlanStatus(
    id: ID,
    status: SavingsPlanStatus,
    options?: { stampCompletedAt?: boolean },
  ): void;
  /** Deletes a plan with no contributions. A plan that has ledger rows tagged
   *  to it is refused (`in-use-transactions`) — archive it instead. */
  deleteSavingsPlan(id: ID): { ok: boolean; reason?: CategoryDeleteReason };
  deleteCategory(id: ID): { ok: boolean; reason?: CategoryDeleteReason };
  addRecurrenceRule(input: RecurrenceRuleInput): void;
  updateRecurrenceRule(id: ID, patch: Partial<RecurrenceRule>): void;
  deleteRecurrenceRule(id: ID): void;
  setSettings(patch: Partial<Settings>): void;
  importState(json: unknown): { ok: boolean; error?: string };
  recoverFromBackup(key: string): { ok: boolean; error?: string };
  resetAll(): void;
  addGeneratedInstances(instances: Transaction[]): void;
}

export function createAppStore() {
  const store = create<AppStore>()(
    persist(
      (set, get) => {
        return {
        state: createInitialState(),

        addTransaction: (input) =>
          set((s) => ({
            state: {
              ...s.state,
              transactions: [
                {
                  id: createId(),
                  categoryId: input.categoryId,
                  amount: input.amount,
                  type: input.type,
                  date: input.date,
                  note: input.note,
                  deferred: input.deferred === true ? true : undefined,
                  savingsPlanId: input.savingsPlanId,
                  createdAt: new Date().toISOString(),
                },
                ...s.state.transactions,
              ],
            },
          })),

        addTransactions: (inputs) =>
          set((s) => ({
            state: {
              ...s.state,
              transactions: [
                ...inputs.map((input) => ({
                  id: createId(),
                  categoryId: input.categoryId,
                  amount: input.amount,
                  type: input.type,
                  date: input.date,
                  note: input.note,
                  deferred: input.deferred === true ? true : undefined,
                  // Statement-import provenance must survive the write — it
                  // is the re-import detection signal (Prompt 5B).
                  importSource: input.importSource,
                  savingsPlanId: input.savingsPlanId,
                  createdAt: new Date().toISOString(),
                })),
                ...s.state.transactions,
              ],
            },
          })),

        updateTransaction: (id, patch) =>
          set((s) => ({
            state: {
              ...s.state,
              transactions: s.state.transactions.map((transaction) =>
                transaction.id === id
                  ? {
                      ...transaction,
                      ...patch,
                      edited: transaction.recurringRuleId
                        ? true
                        : transaction.edited,
                    }
                  : transaction,
              ),
            },
          })),

        deleteTransaction: (id) =>
          set((s) => {
            const transaction = s.state.transactions.find((t) => t.id === id);
            if (!transaction) return s;
            const recurrenceRules = transaction.recurringRuleId
              ? s.state.recurrenceRules.map((rule) => {
                  if (rule.id !== transaction.recurringRuleId) return rule;
                  const month = monthKeyFromIso(transaction.date);
                  const current = rule.exceptions[month];
                  if (current === "skipped") return rule;
                  const next = current ?? [];
                  if (next.includes(transaction.id)) return rule;
                  return {
                    ...rule,
                    exceptions: {
                      ...rule.exceptions,
                      [month]: [...next, transaction.id],
                    },
                  };
                })
              : s.state.recurrenceRules;
            return {
              state: {
                ...s.state,
                recurrenceRules,
                transactions: s.state.transactions.filter((t) => t.id !== id),
              },
            };
          }),

        moveTransactionToNextMonth: (id) =>
          set((s) => {
            const transaction = s.state.transactions.find((t) => t.id === id);
            if (!transaction || transaction.type !== "expense") return s;
            const nextDate = nextMonthDate(transaction.date);
            const recurrenceRules = transaction.recurringRuleId
              ? s.state.recurrenceRules.map((rule) =>
                  rule.id === transaction.recurringRuleId
                    ? recordException(
                        rule,
                        monthKeyFromIso(transaction.date),
                        transaction.id,
                      )
                    : rule,
                )
              : s.state.recurrenceRules;
            return {
              state: {
                ...s.state,
                recurrenceRules,
                transactions: s.state.transactions.map((t) =>
                  t.id === id
                    ? {
                        ...t,
                        date: nextDate,
                        recurringRuleId: undefined,
                        edited: undefined,
                        deferred: true,
                      }
                    : t,
                ),
              },
            };
          }),

        setIncomePlan: (month, id, patch) => {
          if (!isMonth(month)) return false;
          if (patch.name !== undefined) {
            const name = patch.name.trim();
            if (name.length === 0) return false;
            patch = { ...patch, name };
          }
          if (patch.icon !== undefined && typeof patch.icon !== "string") {
            return false;
          }
          for (const amount of [
            patch.expectedAmount,
            patch.receivedAmount,
          ]) {
            if (
              amount !== undefined &&
              (!Number.isInteger(amount) || amount < 0)
            ) {
              return false;
            }
          }
          const { state } = get();
          const existing =
            id === null
              ? undefined
              : state.incomePlans.find((plan) => plan.id === id);
          if (id !== null && !existing) return false;
          const nextName =
            patch.name?.trim() ?? existing?.name ?? "Income";
          const nextIcon = patch.icon ?? existing?.icon ?? "💰";
          const nextExpected =
            patch.expectedAmount ?? existing?.expectedAmount ?? 0;
          const nextReceived =
            patch.receivedAmount ?? existing?.receivedAmount ?? 0;
          if (nextExpected === 0 && nextReceived === 0) {
            if (!existing) return true;
            set((s) => ({
              state: {
                ...s.state,
                incomePlans: s.state.incomePlans.filter(
                  (plan) => plan.id !== existing.id,
                ),
              },
            }));
            return true;
          }
          if (existing) {
            set((s) => ({
              state: {
                ...s.state,
                incomePlans: s.state.incomePlans.map((plan) =>
                  plan.id === existing.id
                    ? {
                        ...plan,
                        name: nextName,
                        icon: nextIcon,
                        expectedAmount: nextExpected,
                        receivedAmount: nextReceived,
                      }
                    : plan,
                ),
              },
            }));
          } else {
            set((s) => ({
              state: {
                ...s.state,
                incomePlans: [
                  {
                    id: createId(),
                    month,
                    name: nextName,
                    icon: nextIcon,
                    expectedAmount: nextExpected,
                    receivedAmount: nextReceived,
                  },
                  ...s.state.incomePlans,
                ],
              },
            }));
          }
          return true;
        },

        addBudget: (input) => {
          const { state } = get();
          const duplicate = state.budgets.some(
            (budget) =>
              budget.categoryId === input.categoryId &&
              budget.month === input.month,
          );
          if (duplicate) return false;
          set((s) => ({
            state: {
              ...s.state,
              budgets: [
                ...s.state.budgets,
                {
                  id: createId(),
                  categoryId: input.categoryId,
                  month: input.month,
                  limit: input.limit,
                  priority: input.priority ?? "medium",
                },
              ],
            },
          }));
          return true;
        },

        updateBudget: (id, patch) =>
          set((s) => {
            const target = s.state.budgets.find((budget) => budget.id === id);
            if (!target) return s;
            const next: Partial<Pick<Budget, "categoryId" | "limit" | "priority">> = {};
            if (
              patch.limit !== undefined &&
              Number.isInteger(patch.limit) &&
              patch.limit >= 0
            ) {
              next.limit = patch.limit;
            }
            if (
              patch.priority === "high" ||
              patch.priority === "medium" ||
              patch.priority === "low"
            ) {
              next.priority = patch.priority;
            }
            if (
              patch.categoryId !== undefined &&
              patch.categoryId !== target.categoryId &&
              patch.categoryId !== "" &&
              !s.state.budgets.some(
                (budget) =>
                  budget.categoryId === patch.categoryId &&
                  budget.month === target.month &&
                  budget.id !== id,
              )
            ) {
              next.categoryId = patch.categoryId;
            }
            if (Object.keys(next).length === 0) return s;
            return {
              state: {
                ...s.state,
                budgets: s.state.budgets.map((budget) =>
                  budget.id === id ? { ...budget, ...next } : budget,
                ),
              },
            };
          }),

        deleteBudget: (id) =>
          set((s) => ({
            state: {
              ...s.state,
              budgets: s.state.budgets.filter((budget) => budget.id !== id),
            },
          })),

        addFutureExpense: (input) => {
          const { state } = get();
          const category = state.categories.find(
            (c) => c.id === input.categoryId,
          );
          if (!category || category.kind !== "expense") return false;
          if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) {
            return false;
          }
          if (typeof input.title !== "string" || input.title.trim().length === 0) {
            return false;
          }
          if (!isIsoDate(input.dueDate)) return false;
          set((s) => ({
            state: {
              ...s.state,
              futureExpenses: [
                {
                  id: createId(),
                  categoryId: input.categoryId,
                  amount: input.amount,
                  title: input.title,
                  dueDate: input.dueDate,
                  notes: input.notes,
                  recurring: input.recurring ?? false,
                  priority: input.priority ?? "medium",
                  status: input.status ?? "upcoming",
                  createdAt: new Date().toISOString(),
                },
                ...s.state.futureExpenses,
              ],
            },
          }));
          return true;
        },

        updateFutureExpense: (id, patch) =>
          set((s) => {
            const next: Partial<FutureExpense> = {};
            if (patch.categoryId !== undefined) {
              const category = s.state.categories.find(
                (c) => c.id === patch.categoryId,
              );
              if (category && category.kind === "expense") {
                next.categoryId = patch.categoryId;
              }
            }
            if (
              patch.amount !== undefined &&
              Number.isFinite(patch.amount) &&
              patch.amount > 0
            ) {
              next.amount = patch.amount;
            }
            if (
              patch.title !== undefined &&
              patch.title.trim().length > 0 &&
              patch.title.length <= MAX_TITLE_LENGTH
            ) {
              next.title = patch.title;
            }
            if (patch.dueDate !== undefined && isIsoDate(patch.dueDate)) {
              next.dueDate = patch.dueDate;
            }
            if (
              patch.notes !== undefined &&
              patch.notes.length <= MAX_NOTE_LENGTH
            ) {
              next.notes = patch.notes;
            }
            if (patch.recurring !== undefined) {
              next.recurring = Boolean(patch.recurring);
            }
            if (
              patch.priority === "high" ||
              patch.priority === "medium" ||
              patch.priority === "low"
            ) {
              next.priority = patch.priority;
            }
            if (patch.status === "upcoming" || patch.status === "paid") {
              next.status = patch.status;
            }
            if (Object.keys(next).length === 0) return s;
            return {
              state: {
                ...s.state,
                futureExpenses: s.state.futureExpenses.map((future) =>
                  future.id === id ? { ...future, ...next } : future,
                ),
              },
            };
          }),

        deleteFutureExpense: (id) =>
          set((s) => ({
            state: {
              ...s.state,
              futureExpenses: s.state.futureExpenses.filter(
                (future) => future.id !== id,
              ),
            },
          })),

        addCategory: (input) => {
          const { state } = get();
          const name = input.name.trim();
          const invalid =
            name.length === 0 ||
            name.length > MAX_CATEGORY_NAME ||
            (input.icon ?? "").trim().length === 0 ||
            !isHexColor(input.color) ||
            (input.kind !== "income" && input.kind !== "expense") ||
            state.categories.some(
              (category) =>
                category.name.toLowerCase() === name.toLowerCase(),
            );
          if (invalid) return false;
          set((s) => ({
            state: {
              ...s.state,
              categories: [
                ...s.state.categories,
                {
                  id: createId(),
                  name,
                  icon: input.icon,
                  color: input.color,
                  kind: input.kind,
                  rollover: input.rollover === true ? true : undefined,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          }));
          return true;
        },

        renameCategory: (id, name) => {
          const { state } = get();
          const target = state.categories.find(
            (category) => category.id === id,
          );
          if (!target) return false;
          const trimmed = name.trim();
          const invalid =
            trimmed.length === 0 ||
            trimmed.length > MAX_CATEGORY_NAME ||
            state.categories.some(
              (category) =>
                category.id !== id &&
                category.name.toLowerCase() === trimmed.toLowerCase(),
            );
          if (invalid) return false;
          set((s) => ({
            state: {
              ...s.state,
              categories: s.state.categories.map((category) =>
                category.id === id ? { ...category, name: trimmed } : category,
              ),
            },
          }));
          return true;
        },

        updateCategory: (id, patch) => {
          const { state } = get();
          const target = state.categories.find(
            (category) => category.id === id,
          );
          if (!target) return false;
          const name =
            patch.name !== undefined ? patch.name.trim() : target.name;
          const icon = patch.icon !== undefined ? patch.icon : target.icon;
          const color = patch.color !== undefined ? patch.color : target.color;
          const invalid =
            name.length === 0 ||
            name.length > MAX_CATEGORY_NAME ||
            (icon ?? "").trim().length === 0 ||
            !isHexColor(color) ||
            state.categories.some(
              (category) =>
                category.id !== id &&
                category.name.toLowerCase() === name.toLowerCase(),
            );
          if (invalid) return false;
          set((s) => ({
            state: {
              ...s.state,
              categories: s.state.categories.map((category) =>
                category.id === id
                  ? { ...category, name, icon, color }
                  : category,
              ),
            },
          }));
          return true;
        },

        setCategoryRollover: (id, rollover) =>
          set((s) => ({
            state: {
              ...s.state,
              categories: s.state.categories.map((category) =>
                category.id === id
                  ? // Stored as absent rather than false, matching the
                    // validator, so an untouched category is byte-identical
                    // to how it looked before this feature existed.
                    { ...category, rollover: rollover ? true : undefined }
                  : category,
              ),
            },
          })),

        setCategoryDebt: (categoryId, input) =>
          set((s) => {
            const existing = s.state.debts.find(
              (debt) => debt.categoryId === categoryId,
            );
            if (input === null) {
              if (!existing) return s;
              return {
                state: {
                  ...s.state,
                  debts: s.state.debts.filter(
                    (debt) => debt.categoryId !== categoryId,
                  ),
                },
              };
            }
            const clean = (value: number) =>
              Number.isFinite(value) && Number.isInteger(value) && value >= 0
                ? value
                : 0;
            const balance = clean(input.balance);
            const now = new Date().toISOString();
            const next: Debt = {
              id: existing?.id ?? createId(),
              categoryId,
              balance,
              // Only set on creation, or when explicitly supplied: editing the
              // current balance must not silently rewrite where it started, or
              // the progress figure would always read 0%.
              startingBalance:
                input.startingBalance !== undefined
                  ? clean(input.startingBalance)
                  : existing
                    ? Math.max(existing.startingBalance, balance)
                    : balance,
              aprBps: clean(input.aprBps),
              minimumPayment: clean(input.minimumPayment),
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            };
            return {
              state: {
                ...s.state,
                debts: existing
                  ? s.state.debts.map((debt) =>
                      debt.categoryId === categoryId ? next : debt,
                    )
                  : [...s.state.debts, next],
              },
            };
          }),

        setDebtStrategy: (strategy) =>
          set((s) =>
            strategy !== "avalanche" && strategy !== "snowball"
              ? s
              : {
                  state: {
                    ...s.state,
                    settings: { ...s.state.settings, debtStrategy: strategy },
                  },
                },
          ),

        grantBadges: (badges) =>
          set((s) => {
            const held = new Set(s.state.badges.map((badge) => badge.id));
            const fresh = badges.filter((badge) => !held.has(badge.id));
            if (fresh.length === 0) return s;
            return { state: { ...s.state, badges: [...s.state.badges, ...fresh] } };
          }),

        applyRollovers: (records) =>
          set((s) => {
            const settled = new Set(
              s.state.rollovers.map((record) => `${record.categoryId}|${record.month}`),
            );
            const fresh = records.filter(
              (record) => !settled.has(`${record.categoryId}|${record.month}`),
            );
            if (fresh.length === 0) return s;
            return {
              state: { ...s.state, rollovers: [...s.state.rollovers, ...fresh] },
            };
          }),

        addSavingsPlan: (input) =>
          set((s) => {
            const name = input.name.trim().slice(0, MAX_TITLE_LENGTH);
            if (name === "") return s;
            const clean = (value: number) =>
              Number.isFinite(value) && Number.isInteger(value) && value >= 0
                ? value
                : 0;
            const plan: SavingsPlan = {
              id: createId(),
              name,
              targetAmount: clean(input.targetAmount),
              // Absent means open-ended — same rule as the validator.
              targetDate:
                input.targetDate && isIsoDate(input.targetDate)
                  ? input.targetDate
                  : undefined,
              startingBalance: clean(input.startingBalance ?? 0),
              status: "active",
              createdAt: new Date().toISOString(),
            };
            return {
              state: { ...s.state, savingsPlans: [...s.state.savingsPlans, plan] },
            };
          }),

        updateSavingsPlan: (id, patch) =>
          set((s) => ({
            state: {
              ...s.state,
              savingsPlans: s.state.savingsPlans.map((plan) => {
                if (plan.id !== id) return plan;
                const name =
                  patch.name !== undefined
                    ? patch.name.trim().slice(0, MAX_TITLE_LENGTH)
                    : plan.name;
                if (name === "") return plan;
                return {
                  ...plan,
                  name,
                  targetAmount:
                    patch.targetAmount !== undefined &&
                    Number.isFinite(patch.targetAmount) &&
                    Number.isInteger(patch.targetAmount) &&
                    patch.targetAmount >= 0
                      ? patch.targetAmount
                      : plan.targetAmount,
                  targetDate:
                    patch.targetDate === undefined
                      ? plan.targetDate
                      : isIsoDate(patch.targetDate)
                        ? patch.targetDate
                        : undefined,
                  startingBalance:
                    patch.startingBalance !== undefined &&
                    Number.isFinite(patch.startingBalance) &&
                    Number.isInteger(patch.startingBalance) &&
                    patch.startingBalance >= 0
                      ? patch.startingBalance
                      : plan.startingBalance,
                };
              }),
            },
          })),

        setSavingsPlanStatus: (id, status, options) =>
          set((s) => ({
            state: {
              ...s.state,
              savingsPlans: s.state.savingsPlans.map((plan) => {
                if (plan.id !== id) return plan;
                // Same status is usually a no-op — except when the completion
                // prompt asks to stamp a plan that is staying open-ended.
                if (plan.status === status && options?.stampCompletedAt !== true) {
                  return plan;
                }
                const now = new Date().toISOString();
                return {
                  ...plan,
                  status,
                  // Stamped once — when the plan is closed out, switched to
                  // ongoing, or kept open past its target at the completion
                  // prompt — and never cleared by a later status change, so
                  // the reached-the-target fact survives.
                  completedAt:
                    plan.completedAt ??
                    (status === "completed" ||
                    status === "ongoing" ||
                    options?.stampCompletedAt === true
                      ? now
                      : undefined),
                  archivedAt:
                    status === "archived" ? (plan.archivedAt ?? now) : plan.archivedAt,
                };
              }),
            },
          })),

        deleteSavingsPlan: (id) => {
          const { state } = get();
          if (!state.savingsPlans.some((plan) => plan.id === id)) {
            return { ok: false, reason: "in-use-transactions" };
          }
          const tagged = state.transactions.some(
            (transaction) => transaction.savingsPlanId === id,
          );
          if (tagged) {
            // Contributions are ledger rows; deleting the plan would either
            // orphan the tag or silently rewrite money history. Archive
            // instead — that hides the plan and keeps every row readable.
            return { ok: false, reason: "in-use-transactions" };
          }
          set((s) => ({
            state: {
              ...s.state,
              savingsPlans: s.state.savingsPlans.filter((plan) => plan.id !== id),
            },
          }));
          return { ok: true };
        },

        deleteCategory: (id) => {
          const { state } = get();
          if (state.transactions.some((t) => t.categoryId === id)) {
            return { ok: false, reason: "in-use-transactions" };
          }
          if (state.budgets.some((b) => b.categoryId === id)) {
            return { ok: false, reason: "in-use-budgets" };
          }
          if (state.recurrenceRules.some((r) => r.categoryId === id)) {
            return { ok: false, reason: "in-use-rules" };
          }
          if (state.futureExpenses.some((f) => f.categoryId === id)) {
            return { ok: false, reason: "in-use-future-expenses" };
          }
          set((s) => ({
            state: {
              ...s.state,
              categories: s.state.categories.filter(
                (category) => category.id !== id,
              ),
              // Carryover history is meaningless without its category, and
              // the validator drops orphans on the next load anyway.
              rollovers: s.state.rollovers.filter(
                (record) => record.categoryId !== id,
              ),
              // A debt record without its category is meaningless, and the
              // validator drops orphans on the next load anyway.
              debts: s.state.debts.filter((debt) => debt.categoryId !== id),
            },
          }));
          return { ok: true };
        },

        addRecurrenceRule: (input) =>
          set((s) => ({
            state: {
              ...s.state,
              recurrenceRules: [
                ...s.state.recurrenceRules,
                {
                  id: createId(),
                  categoryId: input.categoryId,
                  amount: input.amount,
                  type: input.type,
                  frequency: input.frequency,
                  anchorDate: input.anchorDate,
                  note: input.note,
                  enabled: true,
                  exceptions: {},
                },
              ],
            },
          })),

        updateRecurrenceRule: (id, patch) =>
          set((s) => ({
            state: {
              ...s.state,
              recurrenceRules: s.state.recurrenceRules.map((rule) =>
                rule.id === id ? { ...rule, ...patch } : rule,
              ),
            },
          })),

        deleteRecurrenceRule: (id) =>
          set((s) => ({
            state: {
              ...s.state,
              recurrenceRules: s.state.recurrenceRules.filter(
                (rule) => rule.id !== id,
              ),
              transactions: s.state.transactions.filter(
                (transaction) => transaction.recurringRuleId !== id,
              ),
            },
          })),

        setSettings: (patch) =>
          set((s) => ({
            state: {
              ...s.state,
              settings: { ...s.state.settings, ...patch },
            },
          })),

        importState: (json) => {
          try {
            const value = typeof json === "string" ? JSON.parse(json) : json;
            const validated = parseExportPayload(value);
            setWritesEnabled(true);
            useAppStoreErrors.getState().setHydrateError(null);
            set({ state: validated });
            return { ok: true };
          } catch (error) {
            return {
              ok: false,
              error:
                error instanceof Error ? error.message : "Invalid file",
            };
          }
        },

        recoverFromBackup: (key) => {
          const snapshot = loadBackupSnapshot(key);
          if (!snapshot) {
            return { ok: false, error: "Backup not found" };
          }
          try {
            const validated = parseStoredState(snapshot.raw);
            setWritesEnabled(true);
            useAppStoreErrors.getState().setHydrateError(null);
            set({ state: validated });
            return { ok: true };
          } catch (error) {
            return {
              ok: false,
              error:
                error instanceof Error ? error.message : "Backup could not be read",
            };
          }
        },

        resetAll: () => {
          setWritesEnabled(true);
          useAppStoreErrors.getState().setHydrateError(null);
          set({ state: createInitialState() });
        },

        learnFromCorrections: (corrections) =>
          set((s) => {
            if (corrections.length === 0) return s;
            let rules = s.state.learnedRules;
            for (const correction of corrections) {
              rules = recordCorrection(rules, correction);
            }
            return {
              state: { ...s.state, learnedRules: rules },
            };
          }),

        updateLearnedRule: (id, patch) =>
          set((s) => ({
            state: {
              ...s.state,
              learnedRules: s.state.learnedRules.map((rule) =>
                rule.id === id
                  ? { ...rule, ...patch, updatedAt: new Date().toISOString() }
                  : rule,
              ),
            },
          })),

        deleteLearnedRule: (id) =>
          set((s) => ({
            state: {
              ...s.state,
              learnedRules: s.state.learnedRules.filter((rule) => rule.id !== id),
            },
          })),

        clearLearnedRules: () =>
          set((s) =>
            s.state.learnedRules.length === 0
              ? s
              : { state: { ...s.state, learnedRules: [] } },
          ),

        markLearnedRulesUsed: (ids) =>
          set((s) => {
            const next = markRulesUsed(s.state.learnedRules, ids);
            return next === s.state.learnedRules
              ? s
              : { state: { ...s.state, learnedRules: next } };
          }),

        addGeneratedInstances: (instances) =>
          set((s) => {
            const existingIds = new Set(s.state.transactions.map((t) => t.id));
            const fresh = instances.filter((instance) => {
              if (existingIds.has(instance.id)) return false;
              if (!instance.recurringRuleId) return false;
              return !hasGeneratedInstance(
                s.state.transactions,
                instance.recurringRuleId,
                instance.date,
              );
            });
            if (fresh.length === 0) return s;
            return {
              state: {
                ...s.state,
                transactions: [...s.state.transactions, ...fresh],
              },
            };
          }),

        };
      },
      {
        name: STORAGE_KEY,
        version: STORE_VERSION,
        storage: {
          getItem: (name) => {
            if (typeof window === "undefined") return null;
            const raw = getStorageBackend().getItem(name);
            if (raw === null) return null;
            return {
              state: parseStoredState(raw),
              version: STORE_VERSION,
            };
          },
          setItem: (name, value) => {
            if (typeof window === "undefined") return;
            if (!isWritesEnabled()) return;
            try {
              getStorageBackend().setItem(name, JSON.stringify(value));
            } catch {
              // storage unavailable (quota/security); writes resume when it clears
            }
          },
          removeItem: (name) => {
            if (typeof window !== "undefined") {
              getStorageBackend().removeItem(name);
            }
          },
        },
        partialize: (s) => s.state,
        merge: (persisted, current) =>
          persisted
            ? { ...current, state: persisted as AppState }
            : current,
        onRehydrateStorage: () => (_state, error) => {
          queueMicrotask(() => {
            if (error) {
              setWritesEnabled(false);
            }
            useAppStoreErrors.getState().setHydrateError(
              error ? "corrupt" : null,
            );
          });
        },
      },
    ),
  );
  return store;
}

export const useAppStore = createAppStore();
