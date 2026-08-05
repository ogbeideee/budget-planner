import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isIsoDate, isMonth, monthKeyFromIso, nextMonthDate } from "@/lib/date";
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
import {
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
  Month,
  RecurrenceRule,
  RecurrenceRuleInput,
  Settings,
  Transaction,
  TransactionInput,
} from "@/lib/types";

const STORE_VERSION = 3;

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
  addBudget(input: BudgetInput): boolean;
  updateBudget(id: ID, patch: Partial<Pick<Budget, "categoryId" | "limit" | "priority">>): void;
  deleteBudget(id: ID): void;
  addFutureExpense(input: FutureExpenseInput): boolean;
  updateFutureExpense(id: ID, patch: Partial<FutureExpenseInput>): void;
  deleteFutureExpense(id: ID): void;
  addCategory(input: CategoryInput): void;
  renameCategory(id: ID, name: string): void;
  updateCategory(id: ID, patch: Partial<Pick<Category, "name" | "icon" | "color">>): void;
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
                  id: crypto.randomUUID(),
                  categoryId: input.categoryId,
                  amount: input.amount,
                  type: input.type,
                  date: input.date,
                  note: input.note,
                  createdAt: new Date().toISOString(),
                },
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
                    id: crypto.randomUUID(),
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
                  id: crypto.randomUUID(),
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
                  id: crypto.randomUUID(),
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

        addCategory: (input) =>
          set((s) => ({
            state: {
              ...s.state,
              categories: [
                ...s.state.categories,
                {
                  id: crypto.randomUUID(),
                  name: input.name,
                  icon: input.icon,
                  color: input.color,
                  kind: input.kind,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          })),

        renameCategory: (id, name) =>
          set((s) => ({
            state: {
              ...s.state,
              categories: s.state.categories.map((category) =>
                category.id === id ? { ...category, name } : category,
              ),
            },
          })),

        updateCategory: (id, patch) =>
          set((s) => ({
            state: {
              ...s.state,
              categories: s.state.categories.map((category) =>
                category.id === id ? { ...category, ...patch } : category,
              ),
            },
          })),

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
                  id: crypto.randomUUID(),
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
            const validated = parseExportPayload(json);
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
            const raw = window.localStorage.getItem(name);
            if (raw === null) return null;
            return {
              state: parseStoredState(raw),
              version: STORE_VERSION,
            };
          },
          setItem: (name, value) => {
            if (typeof window === "undefined") return;
            if (!isWritesEnabled()) return;
            window.localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(name);
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
