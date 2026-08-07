"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorSwatches } from "@/components/ui/ColorSwatches";
import { IconValue } from "@/components/ui/IconValue";
import { TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";
import { MAX_CATEGORY_NAME } from "@/lib/validate";
import { CATEGORY_COLORS } from "./categoryColors";
import type { Category, CategoryKind } from "@/lib/types";

interface CategoryDraft {
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
}

interface CategoryModalProps {
  category?: Category | null;
  onClose: () => void;
  onRequestDelete?: (category: Category) => void;
}

const DEFAULT_EXPENSE_COLOR = "#ef4444";
const DEFAULT_INCOME_COLOR = "#0ea5e9";

export function CategoryModal({
  category,
  onClose,
  onRequestDelete,
}: CategoryModalProps) {
  const categories = useAppStore((s) => s.state.categories);
  const addCategory = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const { success, error } = useToast();

  // Draft is seeded exactly once at mount (the parent mounts this modal
  // per edit session). It is never synced with store state while editing.
  const [draft, setDraft] = useState<CategoryDraft>(() =>
    category
      ? {
          name: category.name,
          icon: category.icon,
          color: category.color,
          kind: category.kind,
        }
      : {
          name: "",
          icon: "🛒",
          color: DEFAULT_EXPENSE_COLOR,
          kind: "expense",
        },
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = category !== undefined && category !== null;

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) {
      setErrorMessage("Category name is required");
      error("Category name is required");
      return;
    }
    if (name.length > MAX_CATEGORY_NAME) {
      setErrorMessage(
        `Category names are limited to ${MAX_CATEGORY_NAME} characters`,
      );
      error(`Category names are limited to ${MAX_CATEGORY_NAME} characters`);
      return;
    }
    if (!draft.icon.trim()) {
      setErrorMessage("Choose an icon for this category");
      error("Choose an icon for this category");
      return;
    }
    if (
      categories.some(
        (item) =>
          item.id !== category?.id &&
          item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setErrorMessage(`A category named "${name}" already exists`);
      error(`A category named "${name}" already exists`);
      return;
    }
    if (isEdit && category) {
      const saved = updateCategory(category.id, {
        name,
        icon: draft.icon,
        color: draft.color,
      });
      if (!saved) {
        setErrorMessage("Could not save changes.");
        error("Could not save changes.");
        return;
      }
      success("Category updated.");
    } else {
      const added = addCategory({
        name,
        icon: draft.icon,
        color: draft.color,
        kind: draft.kind,
      });
      if (!added) {
        setErrorMessage("Could not add this category.");
        error("Could not add this category.");
        return;
      }
      success("Category added.");
    }
    onClose();
  };

  return (
    <Modal open title={isEdit ? "Edit category" : "New category"} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: `${draft.color}1f`,
              color: draft.color,
            }}
          >
            <IconValue value={draft.icon} className="h-8 w-8 text-3xl" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">
              {draft.name.trim() || "New category"}
            </p>
            <p className="text-sm text-muted">
              {draft.kind === "expense" ? "Expense" : "Income"} category
            </p>
          </div>
        </div>

        {!isEdit && (
          <div>
            <span className="mb-2.5 block text-sm font-semibold text-ink">
              Type
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-canvas p-1">
              {(["expense", "income"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={draft.kind === kind}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      kind,
                      color:
                        kind === "expense"
                          ? DEFAULT_EXPENSE_COLOR
                          : DEFAULT_INCOME_COLOR,
                    }))
                  }
                  className={`h-9 rounded-md text-sm font-semibold capitalize transition-all duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none ${
                    draft.kind === kind
                      ? "bg-surface text-ink shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="category-name"
            className="mb-2.5 block text-sm font-semibold text-ink"
          >
            Name
          </label>
          <input
            id="category-name"
            type="text"
            value={draft.name}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                name: event.target.value,
              }));
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="e.g., Groceries"
            maxLength={MAX_CATEGORY_NAME}
            className="h-11 w-full rounded-xl border border-border/80 bg-surface px-3.5 text-sm text-ink transition-colors placeholder:text-muted/50 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {errorMessage && (
            <p className="mt-1.5 text-sm text-danger">{errorMessage}</p>
          )}
        </div>

        <IconPicker
          label="Icon"
          value={draft.icon}
          onChange={(icon) =>
            setDraft((current) => ({ ...current, icon }))
          }
          vectors={false}
        />

        <ColorSwatches
          label="Color"
          value={draft.color}
          options={CATEGORY_COLORS.map((color) => ({
            value: color.value,
            label: color.name,
          }))}
          onChange={(color) =>
            setDraft((current) => ({ ...current, color }))
          }
        />

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          {isEdit && category && onRequestDelete ? (
            <Button
              variant="danger"
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={() => onRequestDelete(category)}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEdit ? "Save changes" : "Add category"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
