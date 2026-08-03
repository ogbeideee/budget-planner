export type ID = string;
export type Month = string;
export type CategoryKind = "income" | "expense";
export type Priority = "high" | "medium" | "low";
export type Currency = "USD" | "NGN";
export type Theme = "light" | "dark" | "system";

export interface Category {
  id: ID;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  createdAt: string;
}

export interface Budget {
  id: ID;
  categoryId: ID;
  month: Month;
  limit: number;
  priority: Priority;
}

export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  id: ID;
  categoryId: ID;
  amount: number;
  type: CategoryKind;
  frequency: RecurrenceFrequency;
  anchorDate: string;
  note?: string;
  enabled: boolean;
  exceptions: Record<Month, ID[] | "skipped">;
}

export interface Transaction {
  id: ID;
  categoryId: ID;
  amount: number;
  type: CategoryKind;
  date: string;
  note?: string;
  createdAt: string;
  recurringRuleId?: ID;
  edited?: boolean;
  deferred?: boolean;
  monthlyIncome?: boolean;
}

export type FutureExpenseStatus = "upcoming" | "paid";

export interface FutureExpense {
  id: ID;
  categoryId: ID;
  amount: number;
  title: string;
  dueDate: string;
  notes?: string;
  recurring: boolean;
  priority: Priority;
  status: FutureExpenseStatus;
  createdAt: string;
}

export interface Settings {
  currency: Currency;
  recurringEnabled: boolean;
  firstRunDone: boolean;
  theme: Theme;
}

export interface AppState {
  version: 1;
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  futureExpenses: FutureExpense[];
  recurrenceRules: RecurrenceRule[];
  settings: Settings;
}

export interface TransactionInput {
  categoryId: ID;
  amount: number;
  type: CategoryKind;
  date: string;
  note?: string;
}

export interface FutureExpenseInput {
  categoryId: ID;
  amount: number;
  title: string;
  dueDate: string;
  notes?: string;
  recurring?: boolean;
  priority?: Priority;
  status?: FutureExpenseStatus;
}

export interface BudgetInput {
  categoryId: ID;
  month: Month;
  limit: number;
  priority: Priority;
}

export interface CategoryInput {
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
}

export interface RecurrenceRuleInput {
  categoryId: ID;
  amount: number;
  type: CategoryKind;
  frequency: RecurrenceFrequency;
  anchorDate: string;
  note?: string;
}

export type CategoryDeleteReason =
  | "in-use-transactions"
  | "in-use-budgets"
  | "in-use-rules"
  | "in-use-future-expenses";
