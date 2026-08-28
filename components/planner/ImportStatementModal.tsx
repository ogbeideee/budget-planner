"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { memo } from "react";
import type { DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  InfoIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "@/components/ui/icons";
import { isoToDate } from "@/lib/date";
import { DuplicateResolutionPanel } from "./DuplicateResolutionPanel";
import {
  findDuplicateCandidates,
  type DuplicateCandidate,
  type ExistingTransaction,
} from "@/lib/duplicateScore";
import { currencySymbol, formatMoney } from "@/lib/money";
import { isSupportedFile } from "@/lib/statementImport";
import { createTesseractOcrService } from "@/lib/ocrService";
import {
  extractStatementRowsWithOcr,
  isOcrAbort,
  type OcrPhase,
} from "@/lib/statementOcr";
import {
  ledgerKindFor,
  planImport,
  processStatement,
  type DuplicateResolution,
} from "@/lib/statementPipeline";
import type { ImportPlan, StatementPreview } from "@/lib/statementPipeline";
import { isPdfPasswordError } from "@/lib/statementPdf";
import { matchExistingTransaction } from "@/lib/statementIdentity";
import type { DuplicateStatus } from "@/lib/statementIdentity";
import type { LedgerTransactionSlice } from "@/lib/statementIdentity";
import type { RuleCorrectionInput } from "@/lib/learnedRules";
import type {
  BankTransactionKind,
  NormalizedBankTransaction,
} from "@/lib/statementTypes";
import type { Category, Currency } from "@/lib/types";
import { categoryLabel } from "@/lib/categoryDisplay";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";

type ImportStage = "upload" | "processing" | "password" | "preview" | "done";

interface ImportStatementModalProps {
  open: boolean;
  onClose: () => void;
}

const SUPPORTED_TYPES = "csv,xlsx,xls,pdf,.csv,.xlsx,.xls,.pdf";

/** Local OCR service (Tesseract.js WASM, bundled with the app) — shared by
 *  every import session; nothing ever leaves the device. */
const ocrService = createTesseractOcrService();

/** Processing label while a statement is read — switches once OCR kicks in
 *  for scanned PDFs so the user knows what is happening. */
const OCR_PHASE_LABEL: Record<OcrPhase, string> = {
  reading: "Reading your statement…",
  scanning: "Scanning pages…",
  extracting: "Extracting transactions…",
};

/** A preview row: the classified transaction plus the user's session-only
 *  review edits. Nothing here is ever persisted until the (future) confirm. */
interface ReviewRow extends NormalizedBankTransaction {
  /** User wants this row skipped when importing (still shown, marked). */
  excluded: boolean;
  /** Row checked in the bulk-action bar. */
  selected: boolean;
  /** User decision for possible-duplicate rows: skip when importing. */
  skipAsDuplicate: boolean;
  /** FR-23: explicit answer for a row flagged by the duplicate scorer.
   *  Undefined until the user chooses; the import is blocked meanwhile. */
  duplicateResolution?: DuplicateResolution;
}

const KIND_CHIP: Record<BankTransactionKind, { label: string; className: string }> = {
  expense: { label: "Expense", className: "bg-expense-surface text-expense" },
  income: { label: "Income", className: "bg-success-surface text-income" },
  transfer: { label: "Transfer", className: "bg-brand-500/10 text-brand-500" },
  "internal-transfer": { label: "Internal transfer", className: "bg-brand-500/10 text-brand-500" },
  "bank-fee": { label: "Bank fee", className: "bg-sidebar-hover/70 text-muted" },
  tax: { label: "Tax", className: "bg-sidebar-hover/70 text-muted" },
  refund: { label: "Refund", className: "bg-success-surface text-income" },
  interest: { label: "Interest", className: "bg-success-surface text-income" },
  "loan-payment": { label: "Loan payment", className: "bg-sidebar-hover/70 text-muted" },
  savings: { label: "Savings", className: "bg-sidebar-hover/70 text-muted" },
  unknown: { label: "Unknown", className: "bg-warn/10 text-warn" },
};

const CONFIDENCE_BADGE: Record<
  NormalizedBankTransaction["confidence"],
  { label: string; className: string }
> = {
  high: { label: "High", className: "bg-success-surface text-income" },
  medium: { label: "Medium", className: "bg-brand-500/10 text-brand-500" },
  low: { label: "Low", className: "bg-warn/10 text-warn" },
  none: { label: "Uncertain", className: "bg-sidebar-hover/70 text-muted" },
};

type PreviewFilter =
  | "all"
  | "expenses"
  | "income"
  | "transfers"
  | "review"
  | "duplicates"
  | "imported"
  | "possible"
  | "uncategorized"
  | "low-confidence";

const FILTERS: { id: PreviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expenses", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "transfers", label: "Transfers" },
  { id: "review", label: "Needs review" },
  { id: "duplicates", label: "Duplicates" },
  { id: "imported", label: "Already imported" },
  { id: "possible", label: "Possible duplicates" },
  { id: "uncategorized", label: "Uncategorized" },
  { id: "low-confidence", label: "Low confidence" },
];

const KINDS = Object.keys(KIND_CHIP) as BankTransactionKind[];

function amountClassName(tx: NormalizedBankTransaction): string {
  if (tx.type === "income" || tx.type === "refund" || tx.type === "interest") {
    return "text-income";
  }
  if (tx.type === "expense") return "text-expense";
  return "text-ink";
}

/** Finds a 10-digit account number (NUBAN-style) in the statement's
 *  title/header rows and masks it — only the last 4 digits are shown.
 *  Amounts and dates are excluded so they are never mistaken for account
 *  numbers. */
function findMaskedAccount(cells: string[][]): string | null {
  for (const row of cells.slice(0, 12)) {
    for (const raw of row) {
      const cell = String(raw ?? "").trim();
      if (cell === "" || /[,.₦$€£¥/]/.test(cell)) continue;
      const match = cell.match(/\b\d{10}\b/);
      if (match) return `•••• ${match[0].slice(-4)}`;
    }
  }
  return null;
}

/** "Aug 1, 2026 – Aug 4, 2026" from the statement's transaction dates. */
function periodLabel(dates: (string | null | undefined)[]): string {
  const present = dates
    .filter((date): date is string => Boolean(date))
    .sort();
  if (present.length === 0) return "Period unknown";
  const fmt = (iso: string) =>
    isoToDate(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(present[0])} – ${fmt(present[present.length - 1])}`;
}

function matchesFilter(
  tx: ReviewRow,
  filter: PreviewFilter,
  duplicateIds: ReadonlySet<string>,
  statusOf: (id: string) => DuplicateStatus,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "expenses":
      return tx.type === "expense";
    case "income":
      return tx.type === "income" || tx.type === "refund" || tx.type === "interest";
    case "transfers":
      return (
        tx.type === "transfer" ||
        tx.type === "internal-transfer" ||
        tx.type === "savings"
      );
    case "review":
      return tx.needsReview === true && !tx.excluded;
    case "duplicates":
      return duplicateIds.has(tx.id);
    case "imported":
      return statusOf(tx.id) === "already-imported";
    case "possible":
      return statusOf(tx.id) === "possible-duplicate";
    case "uncategorized":
      return (
        ledgerKindFor(tx) !== null && tx.categoryId === null && !tx.excluded
      );
    case "low-confidence":
      return (
        (tx.confidence === "low" || tx.confidence === "none") && !tx.excluded
      );
  }
}

export function ImportStatementModal({ open, onClose }: ImportStatementModalProps) {
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const existingTransactions = useAppStore((s) => s.state.transactions);
  const learnedRules = useAppStore((s) => s.state.learnedRules);
  const addTransactions = useAppStore((s) => s.addTransactions);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const learnFromCorrections = useAppStore((s) => s.learnFromCorrections);
  const markLearnedRulesUsed = useAppStore((s) => s.markLearnedRulesUsed);

  const [stage, setStage] = useState<ImportStage>("upload");
  const [fileName, setFileName] = useState("");
  const [transactions, setTransactions] = useState<ReviewRow[]>([]);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [accountMask, setAccountMask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /** OCR progress for scanned PDFs (null while parsing text statements). */
  const [ocrPhase, setOcrPhase] = useState<OcrPhase | null>(null);
  /** Shown in the preview when some scanned pages could not be read. */
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  /** Aborts the in-flight import when the modal closes mid-OCR. */
  const abortRef = useRef<AbortController | null>(null);
  /** The file waiting for its password (password stage) — kept so Unlock can
   *  retry the SAME file; cleared once the flow moves on. */
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  /** Password typed in the password stage. Held in component state ONLY —
   *  never persisted, logged or sent anywhere. */
  const [pdfPassword, setPdfPassword] = useState("");
  /** Shown in the password stage after an incorrect password attempt. */
  const [passwordError, setPasswordError] = useState<string | null>(null);
  /** Session-id → the correction the user made (chosen category vs the
   *  suggested one). Learnt ONLY for rows that are actually imported. */
  const [corrections, setCorrections] = useState<Map<string, RuleCorrectionInput>>(
    () => new Map(),
  );
  /** Snapshot of the plan captured at click time — the store changes as soon
   *  as the batch is written, and recomputing afterwards would misreport
   *  every imported row as "already existing". */
  const [importResult, setImportResult] = useState<ImportPlan | null>(null);

  const reset = () => {
    setStage("upload");
    setFileName("");
    setTransactions([]);
    setPreview(null);
    setAccountMask(null);
    setError(null);
    setDragging(false);
    setImportResult(null);
    setCorrections(new Map());
    setOcrPhase(null);
    setOcrWarning(null);
    setPendingFile(null);
    setPdfPassword("");
    setPasswordError(null);
  };

  /** Closing (X, overlay, Escape or Cancel) discards the session — nothing
   *  is kept in the component state after a close, and an in-flight OCR
   *  import is cancelled. */
  const handleClose = () => {
    abortRef.current?.abort();
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined, password?: string) => {
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setPasswordError(null);
    if (!isSupportedFile(file.name)) {
      setError(`${file.name} isn't a supported file type. Use CSV, Excel or PDF.`);
      return;
    }
    setFileName(file.name);
    setStage("processing");
    // Yield so the processing state paints before the (possibly heavy) parse.
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const { cells, ocr, rowYs } = await extractStatementRowsWithOcr(file, {
        service: ocrService,
        signal: controller.signal,
        onPhase: setOcrPhase,
        ...(password !== undefined ? { password } : {}),
      });
      if (controller.signal.aborted) return;
      if (cells.length === 0 || cells.every((row) => row.every((cell) => cell.trim() === ""))) {
        if (ocr.ocrUnavailable) {
          setError(
            "This statement is scanned and doesn't contain selectable text. OCR is " +
              "required to read it. The built-in scanner couldn't start on this " +
              "device — if your bank offers a CSV or Excel export, use that instead." +
              (ocr.engineError
                ? `\n\nDiagnostic: ${ocr.engineError}`
                : ""),
          );
        } else if (ocr.ocrUsed) {
          setError(
            "We couldn't read the scanned pages of that statement. If your bank " +
              "offers a CSV or Excel export, use that instead.",
          );
        } else {
          setError("That file looks empty — we couldn't find any rows to read.");
        }
        setStage("upload");
        return;
      }
      const result = processStatement({
        cells,
        context: { currency },
        categories,
        learnedRules,
        rowYs,
      });
      if (result.status === "unsupported") {
        setError(
          `Unsupported bank statement format. ${result.unsupportedReason ?? ""}`,
        );
        setStage("upload");
        return;
      }
      if (result.transactions.length === 0) {
        setError(
          "No transactions could be detected in that file. It may not be a bank " +
            "statement, or its layout isn't supported yet.",
        );
        setStage("upload");
        return;
      }
      setPreview(result);
      setTransactions(
        result.transactions.map((tx) => ({
          ...tx,
          excluded: false,
          selected: false,
          skipAsDuplicate: false,
        })),
      );
      setAccountMask(findMaskedAccount(cells));
      setOcrWarning(
        ocr.ocrUsed && ocr.failedPages.length > 0
          ? `${ocr.failedPages.length} scanned page${
              ocr.failedPages.length === 1 ? "" : "s"
            } couldn't be read — the rest of the statement was imported.`
          : null,
      );
      setStage("preview");
    } catch (error) {
      if (isOcrAbort(error)) return;
      if (isPdfPasswordError(error)) {
        // Password-protected PDF: keep the file, show the password stage.
        // A wrong password stays there for a clean retry; unsupported
        // encryption goes back to upload with a specific message.
        if (error.status === "unsupported-encryption") {
          setError(
            "This PDF uses an encryption method that isn't supported, so we " +
              "can't unlock it. If your bank offers a CSV or Excel export, " +
              "use that instead.",
          );
          setStage("upload");
        } else {
          setPendingFile(file);
          if (error.status === "incorrect-password") {
            setPasswordError("That password is incorrect — try again.");
          }
          setStage("password");
        }
        return;
      }
      setError(
        "We couldn't read that file. It may be password-protected, damaged, or " +
          "in an unexpected format.",
      );
      setStage("upload");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  /** Unlock & continue: retries the pending file with the typed password
   *  (memory-only; the modal clears it on close). */
  const handleUnlock = () => {
    void handleFile(pendingFile ?? undefined, pdfPassword);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  /** Session-only review edits. Settling a row clears its needs-review flag;
   *  changing the kind can invalidate the suggested category. A CATEGORY
   *  change away from the original suggestion is a classification
   *  correction — remembered in-session, learned only if the row is
   *  actually imported (Prompt 6A). */
  const updateRow = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          ReviewRow,
          | "type"
          | "categoryId"
          | "excluded"
          | "selected"
          | "skipAsDuplicate"
          | "duplicateResolution"
        >
      >,
    ) => {
    if ("categoryId" in patch) {
      const chosen = patch.categoryId;
      const original = preview?.transactions.find((tx) => tx.id === id);
      if (original) {
        setCorrections((current) => {
          const next = new Map(current);
          if (
            chosen === null ||
            chosen === undefined ||
            chosen === original.categoryId
          ) {
            next.delete(id);
          } else {
            next.set(id, {
              provider: original.provider,
              merchant: original.merchant,
              description: original.description,
              categoryId: chosen,
            });
          }
          return next;
        });
      }
    }
    setTransactions((current) =>
      current.map((tx) => {
        if (tx.id !== id) return tx;
        const next: ReviewRow = { ...tx, ...patch };
        if ("type" in patch || "categoryId" in patch || "excluded" in patch) {
          next.needsReview = false;
        }
        if ("type" in patch && patch.type !== tx.type) {
          if (ledgerKindFor(tx) !== ledgerKindFor(next)) next.categoryId = null;
        }
        return next;
      }),
    );
    },
    [preview],
  );

  // planImport scans the whole ledger per review row (O(rows × ledger)); it
  // is recomputed ONLY when the session rows, the duplicate report or the
  // ledger change — never on every render (filter clicks, hover, etc.).
  // FR-23: score every ledger-able row against the CURRENT ledger — manual
  // entries and previously-imported ones alike. Derived, never stored, so
  // editing a row's date/amount/category re-scores it immediately.
  const duplicateFlags = useMemo(() => {
    const ledger: ExistingTransaction[] = existingTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      note: tx.note,
      categoryId: tx.categoryId,
      reference: tx.importSource?.reference,
    }));
    const flags = new Map<string, DuplicateCandidate[]>();
    for (const row of transactions) {
      if (row.excluded || row.transactionDate === null) continue;
      const amount = row.debitAmount ?? row.creditAmount;
      if (amount === undefined || !Number.isFinite(amount) || amount <= 0) continue;
      const hits = findDuplicateCandidates(
        {
          date: row.transactionDate,
          amount,
          direction: row.debitAmount !== undefined ? "out" : "in",
          description: row.description,
          categoryId: row.categoryId,
          reference: row.reference,
        },
        ledger,
      );
      if (hits.length > 0) flags.set(row.id, hits);
    }
    return flags;
  }, [transactions, existingTransactions]);

  const plan = useMemo(
    () =>
      preview
        ? planImport(
            transactions.map((row) => {
              const hits = duplicateFlags.get(row.id);
              if (!hits || hits.length === 0) return row;
              return {
                ...row,
                duplicateResolution: row.duplicateResolution ?? "unresolved",
                duplicateOfId: hits[0].existing.id,
              };
            }),
            preview.report.duplicates,
            existingTransactions,
          )
        : {
            inputs: [],
            importedIds: [],
            skipped: {
              excluded: 0,
              movements: 0,
              noDate: 0,
              duplicates: 0,
              alreadyExisting: 0,
              possibleSkipped: 0,
              failed: 0,
            },
            missingCategory: 0,
            unresolvedDuplicates: 0,
            replacedTransactionIds: [],
          },
    [preview, transactions, existingTransactions, duplicateFlags],
  );

  // Rows that were actually imported but still carry the system's "needs
  // review" flag or a low/uncertain confidence — surfaced on the success
  // screen so the user knows which entries may deserve a second look.
  const reviewCount = useMemo(() => {
    if (!importResult) return 0;
    const imported = new Set(importResult.importedIds);
    return transactions.filter(
      (tx) =>
        imported.has(tx.id) &&
        (tx.needsReview ||
          tx.confidence === "low" ||
          tx.confidence === "none"),
    ).length;
  }, [importResult, transactions]);

  const handleImport = () => {
    try {
      // "Replace existing" deletes the old entry as part of the same confirm.
      for (const id of plan.replacedTransactionIds) deleteTransaction(id);
      addTransactions(plan.inputs);
      // Learning (Prompt 6A): only corrections on rows that actually entered
      // the ledger count — a correction that was then excluded, skipped or
      // deduplicated is never learned from.
      const learned = [...corrections.entries()]
        .filter(([id]) => plan.importedIds.includes(id))
        .map(([, correction]) => correction);
      if (learned.length > 0) learnFromCorrections(learned);
      // Usage tracking: a rule counts as USED when a row it pre-filled was
      // actually imported without the user overriding it — which is what
      // makes a mapping that has quietly stopped being right identifiable
      // later. Rows the user corrected are learning, not usage.
      const usedRuleIds = [
        ...new Set(
          transactions
            .filter(
              (row) =>
                plan.importedIds.includes(row.id) &&
                !corrections.has(row.id) &&
                row.categoryReason?.startsWith("learned:"),
            )
            .map((row) => row.categoryReason!.slice("learned:".length)),
        ),
      ]
        .map(
          (signal) =>
            learnedRules.find(
              (rule) => `${rule.kind}:${rule.key}` === signal,
            )?.id,
        )
        .filter((id): id is string => id !== undefined);
      if (usedRuleIds.length > 0) markLearnedRulesUsed(usedRuleIds);
      setImportResult(plan);
      setStage("done");
    } catch {
      // The whole batch is one atomic write — a failure here means nothing
      // was persisted, so the session stays intact and the user can retry.
      setError(
        "We couldn't save these transactions — nothing was changed. Please try again.",
      );
      setStage("upload");
    }
  };

  // Uncategorized ledger rows are SKIPPED, not blocking: the user imports the
  // rows that already have a category and can leave the rest (they're reported
  // on the done screen). The only thing that still stops a finalize is an
  // unanswered duplicate (FR-23: we must not guess double-count vs discard).
  const importBlocked = plan.unresolvedDuplicates > 0;

  const importTitle = importBlocked
    ? `Decide what to do with ${plan.unresolvedDuplicates} possible duplicate${
        plan.unresolvedDuplicates === 1 ? "" : "s"
      } before importing`
    : undefined;

  const footer =
    stage === "preview" ? (
      <>
        <div className="flex min-w-0 flex-col gap-0.5 text-left">
          <p className="text-sm font-semibold text-ink">
            {plan.inputs.length > 0
              ? `You're about to import ${plan.inputs.length} transaction${
                  plan.inputs.length === 1 ? "" : "s"
                }.`
              : plan.missingCategory > 0
                ? "Assign a category to import — uncategorized rows are skipped."
                : "Nothing new will be imported."}
          </p>
          <p className="text-xs text-muted">
            {plan.missingCategory > 0 && plan.inputs.length > 0
              ? `${plan.missingCategory} uncategorized row${
                  plan.missingCategory === 1 ? "" : "s"
                } will be skipped — categorize them to include them.`
              : "Review the rows above — nothing is added to your budget until you import."}
          </p>
        </div>
        <div className="flex-1" />
        <Button variant="ghost" onClick={reset}>
          Choose another file
        </Button>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          disabled={importBlocked}
          title={importBlocked ? importTitle : undefined}
          onClick={handleImport}
        >
          {plan.inputs.length > 0
            ? `Import ${plan.inputs.length} transaction${plan.inputs.length === 1 ? "" : "s"}`
            : "Nothing to import"}
        </Button>
      </>
    ) : stage === "done" ? (
      <>
        <Button variant="ghost" onClick={reset}>
          Add another file
        </Button>
        <div className="flex-1" />
        <Button variant="primary" onClick={handleClose}>
          Done
        </Button>
      </>
    ) : (
      <Button variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
    );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Bank Statement"
      closeButton
      size="md"
      panelClassName="border border-border shadow-card"
      footer={footer}
    >
      {stage === "upload" && (
        <div className="flex flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a bank statement file"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                document.getElementById("statement-file-input")?.click();
              }
            }}
            onClick={() => document.getElementById("statement-file-input")?.click()}
            onDrop={onDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center outline-none transition-colors duration-150 ease-premium focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 ${
              dragging
                ? "border-brand-500 bg-brand-500/[0.06]"
                : "border-border bg-sidebar-hover/30 hover:border-input-hover"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <UploadIcon className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-ink">
                {dragging ? "Drop your statement here" : "Drag & drop your statement here"}
              </p>
              <p className="text-sm text-muted">
                Upload a CSV, Excel or PDF bank statement — we&apos;ll detect the
                transactions for you.
              </p>
            </div>
            <Button variant="secondary" onClick={(event) => {
              event.stopPropagation();
              document.getElementById("statement-file-input")?.click();
            }}>
              Browse files
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {["CSV", "XLSX / XLS", "PDF"].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sidebar-hover/70 px-3 py-1 text-xs font-semibold text-caption"
                >
                  <FileTextIcon className="h-3.5 w-3.5" />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <input
            id="statement-file-input"
            type="file"
            accept={SUPPORTED_TYPES}
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm font-medium text-danger"
            >
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}

      {stage === "processing" && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-500/25 border-t-brand-500" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-ink">
              {ocrPhase === null ? "Parsing your statement…" : OCR_PHASE_LABEL[ocrPhase]}
            </p>
            <p className="text-sm text-muted">{fileName}</p>
          </div>
        </div>
      )}

      {stage === "password" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-ink">Password-protected statement</p>
            <p className="text-sm text-muted">
              This PDF is protected with a password. Enter the PDF password to
              continue.
            </p>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-caption">
            PDF password
            <input
              type="password"
              autoFocus
              value={pdfPassword}
              onChange={(event) => setPdfPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && pdfPassword !== "") {
                  event.preventDefault();
                  handleUnlock();
                }
              }}
              placeholder="Enter the PDF password"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors duration-150 ease-premium hover:border-input-hover focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none"
            />
          </label>
          {passwordError && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm font-medium text-danger"
            >
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {passwordError}
            </p>
          )}
          <p className="text-xs text-muted">{fileName}</p>
          <Button onClick={handleUnlock} disabled={pdfPassword === ""}>
            Unlock &amp; continue
          </Button>
        </div>
      )}

      {stage === "preview" && preview && (
        <PreviewStage
          preview={preview}
          transactions={transactions}
          accountMask={accountMask}
          currency={currency}
          categories={categories}
          existing={existingTransactions}
          duplicateFlags={duplicateFlags}
          updateRow={updateRow}
          ocrWarning={ocrWarning}
        />
      )}

      {stage === "done" && importResult && (
        <DoneStage plan={importResult} reviewCount={reviewCount} />
      )}
    </Modal>
  );
}

function DoneStage({ plan, reviewCount }: { plan: ImportPlan; reviewCount: number }) {
  const added = plan.inputs.length;
  const { skipped } = plan;
  const skippedAsDuplicates = skipped.duplicates + skipped.possibleSkipped;
  const skippedBreakdown = (
    [
      ["money movement", skipped.movements],
      ["duplicate", skipped.duplicates],
      ["excluded", skipped.excluded],
      ["without a date", skipped.noDate],
      ["already existing", skipped.alreadyExisting],
      ["possible duplicate", skipped.possibleSkipped],
      ["uncategorized row", plan.missingCategory],
      ["failed", skipped.failed],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`);

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-surface text-income">
        <CheckIcon className="h-7 w-7" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold text-ink">
          {added === 0
            ? "Nothing new was imported"
            : `${added} transaction${added === 1 ? "" : "s"} added to your budget`}
        </p>
        <p className="text-sm font-medium text-ink">
          {added} imported · {skippedAsDuplicates} skipped as duplicate
          {skippedAsDuplicates === 1 ? "" : "s"} · {reviewCount} requiring review
        </p>
        {skippedBreakdown.length > 0 && (
          <p className="text-sm text-muted">
            Skipped: {skippedBreakdown.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Shared empty array — a fresh `[]` per render would defeat the row memo. */
const EMPTY_CANDIDATES: DuplicateCandidate[] = [];

interface ReviewRowItemProps {
  tx: ReviewRow;
  categories: PreviewStageProps["categories"];
  currency: Currency;
  /** Ledger identity verdict for this row (matched once per review change). */
  status: DuplicateStatus;
  /** Member of a within-statement duplicate group (from the relationship
   *  report, distinct from the ledger-identity `status`). */
  isDuplicate: boolean;
  /** FR-23: existing ledger rows this one scored above the flag threshold
   *  against. Empty for the overwhelming majority of rows. */
  duplicateCandidates: DuplicateCandidate[];
  onUpdate: PreviewStageProps["updateRow"];
}

/** One review row (Prompt 8I.1 redesign). Compact single-line list item by
 *  default: [checkbox] [date] [direction + description] [category]
 *  [confidence] [status] [amount]. Editing controls (type, category) and the
 *  full metadata live in the EXPANDED section — clicking the row (or the
 *  chevron) opens it. Memoized so a correction to a single row re-renders
 *  only that row. */
const ReviewRowItem = memo(function ReviewRowItem({
  tx,
  categories,
  currency,
  status,
  isDuplicate,
  duplicateCandidates,
  onUpdate,
}: ReviewRowItemProps) {
  const [expanded, setExpanded] = useState(false);
  const pool = ledgerKindFor(tx);
  const category = categories.find((c) => c.id === tx.categoryId);
  const missingDate = tx.transactionDate === null;
  const extra = [tx.merchant, tx.provider, tx.channel, tx.originatingBranch]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const amountLabel =
    tx.creditAmount !== undefined
      ? `+${formatMoney(tx.creditAmount, currency)}`
      : tx.debitAmount !== undefined
        ? formatMoney(-tx.debitAmount, currency)
        : "—";

  const toggle = () => setExpanded((value) => !value);

  return (
    <li className={tx.needsReview ? "bg-warn/[0.06]" : ""}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Review ${tx.description}`}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        className="flex cursor-pointer select-none flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3 py-2.5 transition-colors duration-150 ease-premium hover:bg-sidebar-hover/50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
      >
        <input
          type="checkbox"
          aria-label={`Select ${tx.description}`}
          checked={tx.selected}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onUpdate(tx.id, { selected: !tx.selected })}
          className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-brand-500"
        />
        <span
          className={`w-[74px] shrink-0 text-sm tabular-nums ${
            missingDate
              ? "font-semibold text-warn"
              : tx.excluded
                ? "text-muted"
                : "text-ink"
          }`}
        >
          {tx.transactionDate ?? "Date?"}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {tx.direction !== "unknown" && (
            <span
              aria-label={tx.direction === "in" ? "Money in" : "Money out"}
              className="inline-flex shrink-0"
            >
              {tx.direction === "in" ? (
                <ArrowDownLeftIcon className="h-4 w-4 text-income" />
              ) : (
                <ArrowUpRightIcon className="h-4 w-4 text-expense" />
              )}
            </span>
          )}
          <span
            className={`block min-w-0 truncate text-sm ${
              tx.excluded ? "text-muted line-through" : "text-ink"
            }`}
            title={tx.description}
          >
            {tx.description}
          </span>
        </span>
        {category !== undefined ? (
          <span className="shrink-0 rounded-full bg-sidebar-hover/70 px-2 py-0.5 text-xs font-medium text-caption">
            {categoryDisplay(category).icon} {categoryDisplay(category).name}
          </span>
        ) : pool !== null ? (
          <button
            type="button"
            aria-label={`Assign category for ${tx.description}`}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(true);
            }}
            className="shrink-0 rounded-md border border-warn/40 px-2 py-0.5 text-xs font-semibold text-warn transition-colors duration-150 ease-premium hover:bg-warn/10 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
          >
            Assign
          </button>
        ) : (
          <span className="shrink-0 text-xs text-muted">—</span>
        )}
        <span className="hidden shrink-0 text-xs text-muted sm:inline">
          {CONFIDENCE_BADGE[tx.confidence].label}
        </span>
        {tx.excluded && (
          <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
            Excluded
          </span>
        )}
        {!tx.excluded && status === "already-imported" && (
          <span
            title="This transaction is already in your budget — it will be skipped when you import."
            className="shrink-0 rounded-full bg-success-surface px-2 py-0.5 text-xs font-semibold text-income"
          >
            Already imported
          </span>
        )}
        {/* The FR-23 scorer supersedes this older chip when it has flagged
            the row: `planImport` already lets the explicit resolution win, so
            showing both a Skip/Keep toggle and a three-way panel would offer
            the same decision twice in two different shapes. */}
        {!tx.excluded &&
          status === "possible-duplicate" &&
          duplicateCandidates.length === 0 && (
          <>
            <span
              title="This may be the same transaction as one already in your budget — you decide whether to skip it."
              className="shrink-0 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn"
            >
              Possible duplicate
            </span>
            <button
              type="button"
              aria-label={
                tx.skipAsDuplicate
                  ? `Keep possible duplicate ${tx.description}`
                  : `Skip possible duplicate ${tx.description}`
              }
              title={
                tx.skipAsDuplicate
                  ? "Import this transaction after all."
                  : "This may already be in your budget — skip it."
              }
              onClick={(event) => {
                event.stopPropagation();
                onUpdate(tx.id, { skipAsDuplicate: !tx.skipAsDuplicate });
              }}
              className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
            >
              {tx.skipAsDuplicate ? (
                <span className="text-income">Keep</span>
              ) : (
                <span className="text-warn">Skip</span>
              )}
            </button>
          </>
        )}
        {!tx.excluded && duplicateCandidates.length > 0 && (
          <span
            title="Scored against transactions already in your budget — open the row to compare and decide."
            className="shrink-0 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn"
          >
            {tx.duplicateResolution === undefined ||
            tx.duplicateResolution === "unresolved"
              ? "Likely duplicate — decide"
              : "Duplicate resolved"}
          </span>
        )}
        {isDuplicate && (
          <span className="shrink-0 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">
            Duplicate
          </span>
        )}
        {tx.needsReview && (
          <span className="shrink-0 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">
            Needs review
          </span>
        )}
        <span
          className={`w-24 shrink-0 text-right text-sm font-semibold tabular-nums ${
            tx.excluded ? "text-muted" : amountClassName(tx)
          }`}
        >
          {amountLabel}
        </span>
        <button
          type="button"
          aria-label={
            expanded
              ? `Hide details for ${tx.description}`
              : `Show details for ${tx.description}`
          }
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
          className="shrink-0 rounded-md p-0.5 text-muted transition-colors duration-150 ease-premium hover:bg-sidebar-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
        >
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* FR-23: always visible when flagged, never behind the expander — a
          decision the import is blocked on must not be hidden. */}
      {!tx.excluded && duplicateCandidates.length > 0 && (
        <DuplicateResolutionPanel
          incoming={{
            date: tx.transactionDate,
            amountLabel,
            description: tx.description,
            categoryId: tx.categoryId,
          }}
          candidates={duplicateCandidates}
          categories={categories as unknown as Category[]}
          currency={currency}
          resolution={tx.duplicateResolution}
          onResolve={(resolution) => onUpdate(tx.id, { duplicateResolution: resolution })}
        />
      )}

      {expanded && (
        <div className="border-t border-border/60 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <div className="min-w-0 flex-1 text-sm">
              <p className="break-words font-medium text-ink">{tx.description}</p>
              {extra && (
                <p className="mt-0.5 break-words text-xs text-muted">{extra}</p>
              )}
              <dl className="mt-1.5 space-y-0.5 text-xs text-muted">
                {tx.transactionDate && (
                  <div>
                    <dt className="inline">Date: </dt>
                    <dd className="inline">{tx.transactionDate}</dd>
                  </div>
                )}
                {tx.transactionTime && (
                  <div>
                    <dt className="inline">Time: </dt>
                    <dd className="inline">{tx.transactionTime}</dd>
                  </div>
                )}
                {tx.valueDate && (
                  <div>
                    <dt className="inline">Value date: </dt>
                    <dd className="inline">{tx.valueDate}</dd>
                  </div>
                )}
                {tx.reference && (
                  <div>
                    <dt className="inline">Reference: </dt>
                    <dd className="inline break-all">{tx.reference}</dd>
                  </div>
                )}
                {tx.txType && tx.txType !== "unknown" && (
                  <div>
                    <dt className="inline">Transaction type: </dt>
                    <dd className="inline">{tx.txType}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="flex flex-col gap-2 sm:w-64 sm:shrink-0">
              <label className="flex flex-col gap-1 text-xs font-medium text-caption">
                Transaction type
                <select
                  aria-label={`Type for ${tx.description}`}
                  value={tx.type}
                  onChange={(event) =>
                    onUpdate(tx.id, {
                      type: event.target.value as BankTransactionKind,
                    })
                  }
                  className={`h-8 w-full cursor-pointer rounded-md border bg-surface px-2 text-sm transition-colors duration-150 ease-premium hover:border-input-hover focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none ${
                    tx.type === "expense"
                      ? "border-expense/40 text-expense"
                      : tx.type === "income"
                        ? "border-income/40 text-income"
                        : "border-border text-ink"
                  }`}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_CHIP[kind].label}
                    </option>
                  ))}
                </select>
              </label>
              {pool && (
                <label className="flex flex-col gap-1 text-xs font-medium text-caption">
                  <span className="flex flex-wrap items-center gap-1.5">
                    Category
                    {/* The classifier already recorded WHY it chose this
                        category; a learned match is the one worth telling the
                        user about, because it came from their own past
                        correction rather than a built-in keyword. The row is
                        still theirs to change before the batch is imported. */}
                    {tx.categoryReason?.startsWith("learned:") && (
                      <span
                        title="Pre-filled from a category you chose on a past import. Change it here if it is wrong."
                        className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-caption font-semibold text-brand-600 dark:text-brand-400"
                      >
                        <SparklesIcon className="h-3 w-3 shrink-0" />
                        Learned
                      </span>
                    )}
                  </span>
                  <select
                    aria-label={`Category for ${tx.description}`}
                    value={tx.categoryId ?? ""}
                    onChange={(event) =>
                      onUpdate(tx.id, { categoryId: event.target.value })
                    }
                    className={`h-8 w-full cursor-pointer rounded-md border bg-surface px-2 text-sm text-ink transition-colors duration-150 ease-premium hover:border-input-hover focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none ${
                      tx.categoryId === null ? "border-warn/40" : "border-border"
                    }`}
                  >
                    {tx.categoryId === null && (
                      <option value="" disabled>
                        Choose a category…
                      </option>
                    )}
                    {categories
                      .filter((category) => category.kind === pool)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {categoryLabel(category.name)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <span className="text-xs text-muted">
                Confidence: {CONFIDENCE_BADGE[tx.confidence].label}
              </span>
              <button
                type="button"
                aria-label={
                  tx.excluded
                    ? `Include ${tx.description}`
                    : `Exclude ${tx.description}`
                }
                onClick={() => onUpdate(tx.id, { excluded: !tx.excluded })}
                className="self-start rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted transition-colors duration-150 ease-premium hover:bg-sidebar-hover hover:text-danger focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
              >
                {tx.excluded ? "Include in import" : "Exclude from import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
});

interface PreviewStageProps {
  preview: StatementPreview;
  transactions: ReviewRow[];
  accountMask: string | null;
  currency: Currency;
  categories: { id: string; name: string; icon: string; kind: "income" | "expense" }[];
  existing: readonly LedgerTransactionSlice[];
  /** FR-23: rows flagged as likely duplicates, keyed by review-row id. */
  duplicateFlags: Map<string, DuplicateCandidate[]>;
  updateRow: (
    id: string,
    patch: Partial<
      Pick<ReviewRow, "type" | "categoryId" | "excluded" | "selected" | "skipAsDuplicate" | "duplicateResolution">
    >,
  ) => void;
  /** Set when some scanned pages couldn't be read — the rest is imported. */
  ocrWarning?: string | null;
}

const PreviewStage = memo(function PreviewStage({
  preview,
  transactions,
  accountMask,
  currency,
  categories,
  existing,
  duplicateFlags,
  updateRow,
  ocrWarning = null,
}: PreviewStageProps) {
  const [filter, setFilter] = useState<PreviewFilter>("all");

  // Every row is matched against the whole ledger once per review change —
  // never on each render (the parent re-renders with the same props often).
  const statusById = useMemo(() => {
    const map = new Map<string, DuplicateStatus>();
    for (const tx of transactions) {
      map.set(tx.id, matchExistingTransaction(tx, existing).status);
    }
    return map;
  }, [transactions, existing]);
  const statusOf = useCallback(
    (id: string): DuplicateStatus => statusById.get(id) ?? "new",
    [statusById],
  );
  const possibleCount = useMemo(
    () => transactions.filter((tx) => statusOf(tx.id) === "possible-duplicate").length,
    [transactions, statusOf],
  );

  const active = transactions.filter((tx) => !tx.excluded);
  const needsReviewCount = active.filter((tx) => tx.needsReview).length;
  const expenseCount = active.filter((tx) => tx.type === "expense").length;
  const incomeCount = active.filter(
    (tx) => tx.type === "income" || tx.type === "refund" || tx.type === "interest",
  ).length;
  const transferCount = active.filter(
    (tx) =>
      tx.type === "transfer" || tx.type === "internal-transfer" || tx.type === "savings",
  ).length;
  const excludedCount = transactions.length - active.length;
  const uncategorizedCount = active.filter(
    (tx) => ledgerKindFor(tx) !== null && tx.categoryId === null,
  ).length;
  const lowConfidenceCount = active.filter(
    (tx) => tx.confidence === "low" || tx.confidence === "none",
  ).length;
  const skipped = preview.skipped;
  const unreadable = preview.errors;
  const duplicates = preview.report.duplicates;
  const links = preview.report.links;
  const duplicateIds = useMemo(
    () => new Set(duplicates.flatMap((group) => group.ids)),
    [duplicates],
  );
  const duplicateCount = transactions.filter((tx) => duplicateIds.has(tx.id)).length;

  const selected = transactions.filter((tx) => tx.selected);

  // Rows the master "Select all" control may select: everything that can
  // actually enter the ledger — excluded rows, money movements (transfers,
  // fees, …), rows without a date and rows already in the budget are not
  // selectable (the same hard rules planImport applies).
  const selectable = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          !tx.excluded &&
          ledgerKindFor(tx) !== null &&
          tx.transactionDate !== null &&
          statusOf(tx.id) !== "already-imported",
      ),
    [transactions, statusOf],
  );
  const selectedSelectable = useMemo(
    () => selectable.filter((tx) => tx.selected),
    [selectable],
  );
  const allSelectableSelected =
    selectable.length > 0 && selectedSelectable.length === selectable.length;
  const partiallySelected =
    !allSelectableSelected && selectedSelectable.length > 0;
  const masterRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (masterRef.current) {
      masterRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);


  const visible = transactions.filter((tx) => matchesFilter(tx, filter, duplicateIds, statusOf));

  const stats = [
    { label: "transactions", value: transactions.length },
    { label: "expenses", value: expenseCount },
    { label: "income", value: incomeCount },
    { label: "transfers", value: transferCount },
    { label: "needs review", value: needsReviewCount },
    { label: "duplicates", value: duplicateCount },
    { label: "uncategorized", value: uncategorizedCount },
    { label: "low confidence", value: lowConfidenceCount },
    { label: "excluded", value: excludedCount },
  ];

  const countFor = (id: PreviewFilter): number =>
    transactions.filter((tx) => matchesFilter(tx, id, duplicateIds, statusOf)).length;

  const assignBulkCategory = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    updateBulk((tx) =>
      ledgerKindFor(tx) === category.kind
        ? { ...tx, categoryId, needsReview: false }
        : tx,
    );
  };

  const setBulkExcluded = (excluded: boolean) => {
    updateBulk((tx) => ({ ...tx, excluded, needsReview: false }));
  };

  const updateBulk = (map: (tx: ReviewRow) => ReviewRow) => {
    for (const row of selected) {
      const next = map(row);
      updateRow(row.id, {
        type: next.type,
        categoryId: next.categoryId,
        excluded: next.excluded,
        selected: next.selected,
      });
    }
  };

  /** Master checkbox: with every selectable row checked it clears the whole
   *  selection ("Deselect all"); otherwise it checks every selectable row. */
  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      for (const row of selected) updateRow(row.id, { selected: false });
    } else {
      for (const row of selectable) {
        if (!row.selected) updateRow(row.id, { selected: true });
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-sidebar-hover/30 px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-500">
            <FileTextIcon className="h-3.5 w-3.5" />
            {preview.detectedLabel} statement
          </span>
          {accountMask && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sidebar-hover/70 px-2.5 py-0.5 text-xs font-semibold text-caption">
              Account {accountMask}
            </span>
          )}
          <span className="text-xs text-muted">{periodLabel(transactions.map((tx) => tx.transactionDate))}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            {currencySymbol(currency)}
            <span className="uppercase">{currency}</span>
          </span>
        </div>

        <div
          role="group"
          aria-label="Statement summary"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
        >
          {stats.map((stat) => (
            <span key={stat.label} className="flex items-baseline gap-1">
              <b className="font-semibold text-ink">{stat.value}</b>
              <span className="text-muted">{stat.label}</span>
            </span>
          ))}
        </div>

        {(skipped > 0 || unreadable.length > 0) && (
          <p className="text-xs text-muted">
            {skipped > 0 && (
              <>
                {skipped} row{skipped === 1 ? "" : "s"} skipped
                {unreadable.length > 0 && " · "}
              </>
            )}
            {unreadable.length > 0 && (
              <>
                {unreadable.length} row{unreadable.length === 1 ? "" : "s"} couldn&apos;t be read
              </>
            )}
          </p>
        )}

        {ocrWarning && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
            <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            {ocrWarning}
          </p>
        )}
      </div>

      {duplicates.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-warn/[0.06] px-3 py-2 text-sm font-medium text-warn">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          {duplicates.length === 1
            ? "1 possible duplicate detected — the same transaction appears more than once. We'll import it once and skip the repeat automatically."
            : `${duplicates.length} groups of possible duplicates detected — the same transactions appear more than once. We'll import each one once and skip the repeats automatically.`}
        </p>
      )}
      {possibleCount > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-warn/[0.06] px-3 py-2 text-sm font-medium text-warn">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          {possibleCount === 1
            ? "1 transaction may already be in your budget — check the Possible duplicate badge, then skip or keep it."
            : `${possibleCount} transactions may already be in your budget — check the Possible duplicate badges, then skip or keep each one.`}
        </p>
      )}
      {links.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-brand-500/[0.06] px-3 py-2 text-sm text-ink">
          <InfoIcon className="h-4 w-4 shrink-0" />
          {links.length === 1
            ? "1 money-movement link spotted (e.g. a transfer funded by a savings withdrawal) — these aren't spending."
            : `${links.length} money-movement links spotted (e.g. transfers funded by savings withdrawals) — these aren't spending.`}
        </p>
      )}

      <div
        role="group"
        aria-label="Filter transactions"
        className="flex flex-wrap items-center gap-1.5"
      >
        {FILTERS.map(({ id, label }) => {
          const activeFilter = filter === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={activeFilter}
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none ${
                activeFilter
                  ? "bg-brand-500/10 text-brand-500"
                  : "bg-sidebar-hover/70 text-caption hover:text-ink"
              }`}
            >
              {label} <span className="opacity-70">{countFor(id)}</span>
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Bulk actions"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/60 bg-brand-500/[0.04] px-3 py-2"
      >
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            ref={masterRef}
            aria-label={
              allSelectableSelected
                ? "Deselect all transactions"
                : "Select all transactions"
            }
            checked={allSelectableSelected}
            disabled={selectable.length === 0}
            onChange={toggleSelectAll}
            className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-brand-500"
          />
          <span className="text-sm font-semibold text-ink">
            {allSelectableSelected ? "Deselect all" : "Select all"}
          </span>
        </label>
        {selected.length > 0 && (
          <>
            <span className="text-sm font-semibold text-ink">
              {selected.length} selected
            </span>
            <select
              aria-label="Assign category to selected"
              value=""
              onChange={(event) => assignBulkCategory(event.target.value)}
              className="h-8 w-44 shrink-0 cursor-pointer rounded-md border border-border bg-surface px-2 text-sm text-ink transition-colors duration-150 ease-premium hover:border-input-hover focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none"
            >
              <option value="" disabled>
                Assign category…
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryDisplay(category).icon} {categoryDisplay(category).name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={() => setBulkExcluded(true)}>
              <XIcon className="h-3.5 w-3.5" />
              Exclude
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkExcluded(false)}>
              <CheckIcon className="h-3.5 w-3.5" />
              Include
            </Button>
            <Button size="sm" variant="ghost" onClick={() => updateBulk((tx) => ({ ...tx, selected: false }))}>
              Clear selection
            </Button>
          </>
        )}
      </div>

      <div className="max-h-[46vh] overflow-y-auto overscroll-contain rounded-xl border border-border/60">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No transactions match this filter.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {visible.map((tx) => (
              <ReviewRowItem
                key={tx.id}
                tx={tx}
                categories={categories}
                currency={currency}
                status={statusOf(tx.id)}
                isDuplicate={duplicateIds.has(tx.id)}
                duplicateCandidates={duplicateFlags.get(tx.id) ?? EMPTY_CANDIDATES}
                onUpdate={updateRow}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted">
        <InfoIcon className="h-3.5 w-3.5 shrink-0" />
        Your edits stay in this session — nothing has been added to your budget yet.
      </p>
    </div>
  );
});