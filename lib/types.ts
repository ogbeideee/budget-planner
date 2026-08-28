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
  /** Opt-in: unspent funds carry into the next month's limit instead of
   *  resetting. Absent/false on every existing and new category — only an
   *  explicit toggle sets it, never a migration or a bulk default. Lives on
   *  the category rather than the per-month Budget so the preference is sticky
   *  across months; budgets are created fresh each month, so a per-budget flag
   *  would silently switch itself off every month. */
  rollover?: boolean;
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
  /** Where this transaction came from, when it was imported from a bank
   *  statement (Prompt 5A). Used for provenance and re-import detection. */
  importSource?: ImportProvenance;
}

/** Provenance preserved for transactions confirmed through a statement
 *  import. Optional on Transaction: normal/manual transactions have none.
 *  All strings are capped by the validator (MAX_NOTE_LENGTH). */
export interface ImportProvenance {
  /** How the transaction entered the ledger. */
  source: "statement-import";
  /** Issuing bank detected for the statement. */
  bank: "gtco" | "opay" | "kuda" | "palmpay" | "owealth" | "other" | "unknown";
  /** The bank's own transaction reference (capped) — the strongest signal
   *  for detecting a re-import of the same statement. */
  reference?: string;
  /** Original narration as written by the bank (capped), before any
   *  cleaning — kept for provenance, never shown in the ledger. */
  originalDescription?: string;
  /** Value date reported by the statement, when different from the
   *  transaction date. */
  statementDate?: string;
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

export type PayoffStrategyPreference = "avalanche" | "snowball";

export interface Settings {
  currency: Currency;
  recurringEnabled: boolean;
  firstRunDone: boolean;
  theme: Theme;
  /** Which payoff projection to surface prominently (FR-20). A display
   *  preference only — this app never moves money. */
  debtStrategy: PayoffStrategyPreference;
}

export interface IncomePlan {
  id: ID;
  month: Month;
  name: string;
  icon: string;
  expectedAmount: number;
  receivedAmount: number;
}

/** A rule learned from repeated user classification corrections (Prompt 6A).
 *  Stored in AppState so it is validated, migrated, exported and backed up
 *  with everything else — the SQLite architecture holds one state row.
 *  `strength` counts confirmed corrections; a rule only fires once
 *  `strength` reaches the activation threshold (never from one correction).
 *  A correction that contradicts an existing rule re-baselines it (mapping
 *  replaced, strength reset) — flip-flopping never activates anything. */
export interface LearnedRule {
  id: ID;
  /** Which surface learned it. */
  source: "statement-import";
  /** The signal the rule keys on — provider is more specific than merchant,
   *  which is more specific than the full normalized description. */
  kind: "provider" | "merchant" | "description";
  /** Normalized key (lowercase, whitespace-collapsed). */
  key: string;
  /** The category the user repeatedly assigned to matching transactions. */
  categoryId: ID;
  /** Confirmed corrections so far (1 = candidate only, never applied). */
  strength: number;
  /** False until strength reaches the activation threshold. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  /** When this rule last produced a suggestion the user actually imported.
   *  Absent until it has been used once. Recorded so mappings that stop being
   *  confirmed can be spotted later; nothing expires automatically today. */
  lastUsedAt?: string;
}

/**
 * One category's carryover into one month — a historical record, written once
 * at the month transition and never recalculated.
 *
 * Persisting the computed amount (rather than deriving it on read) is what
 * keeps a past month's effective limit equal to what it actually was: later
 * edits to the source month's transactions, a changed cap default, or the
 * rollover switch being flipped afterwards all leave settled months alone.
 */
export interface RolloverRecord {
  id: ID;
  categoryId: ID;
  /** The month the funds carried INTO — the month whose limit this boosts. */
  month: Month;
  /** The month the funds came FROM (always the month before `month`). */
  fromMonth: Month;
  /** Amount actually added to `month`'s base limit, after the cap. */
  amount: number;
  /** Uncapped unspent balance at `fromMonth`'s close, kept so a capped
   *  carryover can be explained rather than just looking wrong. */
  leftover: number;
  /** The cap in force when this ran, so changing the default later stays
   *  auditable and cannot rewrite this month. */
  cap: number;
  computedAt: string;
}

/**
 * Debt tracking for one category (FR-20). A SEPARATE record linked one-to-one
 * to a category by `categoryId`, deliberately not folded into `Budget`:
 * balance, interest rate and minimum payment describe an obligation that
 * outlives any single month, whereas a budget limit is one month's spending
 * allowance. Overloading the two would have made a limit mean different things
 * for different categories.
 *
 * A category with no `Debt` record behaves exactly as it always has — this is
 * purely additive.
 */
export interface Debt {
  id: ID;
  /** The category this debt tracks. Exactly one Debt per category. */
  categoryId: ID;
  /** Outstanding balance in minor units, >= 0. */
  balance: number;
  /** What was owed at the start, in minor units — for progress display only;
   *  never used by the payoff engine. */
  startingBalance: number;
  /** Annual rate in integer BASIS POINTS (1250 = 12.5%). Stored as an integer
   *  for the same reason money is: no float drift in persisted data. 0 is
   *  valid and common — interest-free family or informal loans. */
  aprBps: number;
  /** Contractual minimum monthly payment in minor units, >= 0. */
  minimumPayment: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A badge the user has earned (FR-21). Append-only: an achievement is never
 * revoked, so a later streak reset cannot take one away.
 *
 * Only the FACT of earning is stored. Name, icon, description and criteria all
 * live in the `BADGES` definition list (lib/streak.ts) and are looked up by
 * `id`, so editing wording or artwork never needs a migration.
 */
export interface EarnedBadge {
  /** Matches a `BadgeDefinition.id`. */
  id: string;
  earnedAt: string;
  /** The streak value at the moment it was earned — context for a future
   *  perk system, so it need not recompute history. */
  value: number;
}

export interface AppState {
  version: 9;
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  futureExpenses: FutureExpense[];
  recurrenceRules: RecurrenceRule[];
  incomePlans: IncomePlan[];
  learnedRules: LearnedRule[];
  rollovers: RolloverRecord[];
  debts: Debt[];
  badges: EarnedBadge[];
  settings: Settings;
}

export interface TransactionInput {
  categoryId: ID;
  amount: number;
  type: CategoryKind;
  date: string;
  note?: string;
  /** Transfer flag — recorded as an expense that rolls into the next month. */
  deferred?: boolean;
  /** Statement-import provenance; set by the import engine only. */
  importSource?: ImportProvenance;
}

/**
 * A form-draft seed for a NEW entry, produced by the FR-25 quick-add
 * suggestions (a detected recurring pattern). Values FREEZE into the
 * TransactionForm's draft at mount (the documented lazy-initializer case —
 * callers restart with a keyed remount); nothing here auto-saves.
 * `amountMinor` is integer minor units, like every other money value.
 */
export interface TransactionPrefill {
  categoryId?: ID;
  amountMinor?: number;
  date?: string;
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
  rollover?: boolean;
}

export interface RecurrenceRuleInput {
  categoryId: ID;
  amount: number;
  type: CategoryKind;
  frequency: RecurrenceFrequency;
  anchorDate: string;
  note?: string;
}

/** Fields the debt form edits; the rest of a `Debt` is managed by the store. */
export interface DebtInput {
  balance: number;
  startingBalance?: number;
  aprBps: number;
  minimumPayment: number;
}

export type CategoryDeleteReason =
  | "in-use-transactions"
  | "in-use-budgets"
  | "in-use-rules"
  | "in-use-future-expenses"
  | "in-use-income-plans";
