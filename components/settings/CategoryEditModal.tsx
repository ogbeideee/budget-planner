"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { IconPicker } from "@/components/ui/IconPicker";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";
import { CATEGORY_COLORS } from "./CategoryManager";
import type { Category } from "@/lib/types";

interface CategoryEditModalProps {
  category: Category;
  onClose: () => void;
}

export function CategoryEditModal({
  category,
  onClose,
}: CategoryEditModalProps) {
  const updateCategory = useAppStore((s) => s.updateCategory);
  const { success, error } = useToast();

  // Draft is seeded exactly once at mount (the parent mounts this modal
  // per edit session). It is never synced with store state while editing.
  const [draft, setDraft] = useState<Category>(category);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) {
      setErrorMessage("Category name is required");
      error("Category name is required");
      return;
    }
    updateCategory(draft.id, {
      name,
      icon: draft.icon,
      color: draft.color,
    });
    success("Category updated.");
    onClose();
  };

  return (
    <Modal open title="Edit category" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="category-edit-name"
            className="block text-sm font-medium text-ink mb-1.5"
          >
            Name
          </label>
          <input
            id="category-edit-name"
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
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {errorMessage && (
            <p className="mt-1.5 text-sm text-danger">{errorMessage}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <IconPicker
            label="Icon"
            value={draft.icon}
            onChange={(icon) =>
              setDraft((current) => ({ ...current, icon }))
            }
            vectors={false}
          />
          <Select
            label="Color"
            value={draft.color}
            options={CATEGORY_COLORS.map((color) => ({
              value: color.value,
              label: color.name,
            }))}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                color: event.target.value,
              }))
            }
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
