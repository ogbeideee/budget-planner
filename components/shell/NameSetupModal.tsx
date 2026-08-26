"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { saveDisplayName } from "@/lib/displayName";
import { useDisplayName } from "@/store/useDisplayName";

const FIELD =
  "h-12 rounded-md border border-border bg-surface px-4 text-input text-ink transition-[border-color,box-shadow] duration-150 ease-premium placeholder:text-muted focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none";

export function NameSetupModal() {
  const name = useDisplayName((s) => s.name);
  const ready = useDisplayName((s) => s.ready);
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const valid = trimmed.length > 0;

  const submit = () => {
    if (!valid) return;
    saveDisplayName(trimmed);
    useDisplayName.setState({ name: trimmed });
    setDraft("");
  };

  // Deliberately non-dismissable: it is a one-time setup step and disappears
  // for good once the name is saved (the store then reads non-null). The
  // `ready` gate keeps it out of the server HTML (the store is seeded at mount
  // in AppShell), so its presence never diverges between SSR and hydration.
  return (
    <Modal
      open={ready && name === null}
      onClose={() => undefined}
      title="What should we call you?"
      describedBy="name-setup-copy"
      size="sm"
    >
      <div className="flex flex-col gap-5 pb-4">
        <p id="name-setup-copy" className="text-description font-medium text-muted">
          Tell us your name so we can make your Budget Planner feel a little
          more personal.
        </p>
        <label className="flex flex-col gap-2">
          <span className="sr-only">Your name</span>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder="Enter your name"
            aria-label="Your name"
            maxLength={60}
            className={FIELD}
          />
        </label>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={!valid} className="min-w-28">
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
}