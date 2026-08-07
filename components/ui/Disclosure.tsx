"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useSyncExternalStore,
} from "react";
import type { ReactNode, Ref } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { getStorageBackend } from "@/lib/storageAdapter";

const KEY_PREFIX = "disclosure:";

function readStored(id: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = getStorageBackend().getItem(KEY_PREFIX + id);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function writeStored(id: string, open: boolean): void {
  try {
    getStorageBackend().setItem(KEY_PREFIX + id, open ? "1" : "0");
  } catch {
    // storage unavailable — treat as ephemeral
  }
}

interface DisclosureStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => boolean;
  set: (value: boolean) => void;
}

const stores = new Map<string, DisclosureStore>();

function storeFor(id: string, fallback: boolean): DisclosureStore {
  const existing = stores.get(id);
  if (existing) return existing;
  const listeners = new Set<() => void>();
  const store: DisclosureStore = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => readStored(id, fallback),
    set: (value) => {
      writeStored(id, value);
      listeners.forEach((listener) => listener());
    },
  };
  stores.set(id, store);
  return store;
}

export interface DisclosureHandle {
  expand: () => void;
}

export interface DisclosureProps {
  id: string;
  title: string;
  badge?: ReactNode;
  action?: (toggle: () => void) => ReactNode;
  preview?: (toggle: () => void) => ReactNode;
  children: ReactNode;
  variant?: "panel" | "section" | "quiet" | "brand";
  className?: string;
  defaultOpen?: boolean;
  ref?: Ref<DisclosureHandle>;
}

const CHROME: Record<"panel" | "section" | "quiet" | "brand", string> = {
  panel: "rounded-xl border border-border/70 bg-surface shadow-card",
  section: "",
  quiet: "rounded-xl border border-border/50 bg-canvas/40",
  brand: "rounded-xl border border-brand-500/20 bg-surface shadow-card",
};

export function Disclosure({
  id,
  title,
  badge,
  action,
  preview,
  children,
  variant = "panel",
  className = "",
  defaultOpen = false,
  ref,
}: DisclosureProps) {
  const store = storeFor(id, defaultOpen);

  const serverSnapshot = useCallback(() => defaultOpen, [defaultOpen]);
  const open = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    serverSnapshot,
  );

  useEffect(() => {
    writeStored(id, open);
  }, [id, open]);

  const toggle = () => {
    store.set(!open);
  };

  useImperativeHandle(ref, () => ({
    expand: () => {
      if (!open) toggle();
    },
  }));

  const isPanel = variant === "panel" || variant === "quiet" || variant === "brand";
  const content = open ? children : preview?.(toggle);

  return (
    <section className={`${CHROME[variant]} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={toggle}
          className={`group flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none ${
            isPanel
              ? "rounded-xl px-6 py-4 transition-colors duration-150 ease-premium hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset"
              : "rounded-md px-2 py-2 focus-visible:ring-2 focus-visible:ring-brand-500/60"
          }`}
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-default ease-premium group-hover:text-ink motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
          />
          <span className="truncate text-base font-semibold tracking-tight text-ink">
            {title}
          </span>
          {badge}
        </button>
        {action && (
          <div className="flex shrink-0 items-center gap-2 pr-7">
            {action(toggle)}
          </div>
        )}
      </div>
      <div
        id={`${id}-panel`}
        role="region"
        aria-label={title}
        style={{ gridTemplateRows: content != null ? "1fr" : "0fr" }}
        className="grid transition-[grid-template-rows] duration-default ease-premium motion-reduce:transition-none"
      >
        <div className="min-h-0 overflow-y-clip">
          {content != null && (
            <div
              className={`animate-[list-in_200ms_var(--ease-premium)] ${
                isPanel ? "px-6 pb-6 pt-1" : "px-2 pb-2"
              }`}
            >
              {content}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
