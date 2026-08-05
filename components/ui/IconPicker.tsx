"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconValue } from "@/components/ui/IconValue";
import { Modal } from "@/components/ui/Modal";
import { ChevronDownIcon } from "@/components/ui/icons";
import {
  findIconByEmoji,
  ICON_GROUPS,
  labelForEmoji,
  matchIcon,
} from "@/components/settings/iconLibrary";
import type { IconOption } from "@/components/settings/iconLibrary";

const RECENT_KEY = "settings:recent-icons";
const FAVOURITE_KEY = "settings:favourite-icons";
const MAX_RECENT = 8;
const MAX_FAVOURITES = 24;
const COLUMNS = 6;

function readList(key: string, max: number): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string" || seen.has(item)) continue;
      seen.add(item);
      result.push(item);
      if (result.length >= max) break;
    }
    return result;
  } catch {
    return [];
  }
}

function writeList(key: string, icons: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(icons));
  } catch {
    // storage unavailable — lists are ephemeral
  }
}

const readRecent = () => readList(RECENT_KEY, MAX_RECENT);
const readFavourites = () => readList(FAVOURITE_KEY, MAX_FAVOURITES);
const writeRecent = (icons: string[]) => writeList(RECENT_KEY, icons);
const writeFavourites = (icons: string[]) =>
  writeList(FAVOURITE_KEY, icons);

interface IconSection {
  id: string;
  label: string;
  icons: IconOption[];
}

function withoutVectors(icon: IconOption | undefined): IconOption | undefined {
  if (icon === undefined || icon.kind === "vector") return undefined;
  return icon;
}

function buildSections(
  recent: string[],
  favourites: string[],
  query: string,
  includeVectors: boolean,
): IconSection[] {
  const search = query.trim().toLowerCase();
  const visible = (icon: IconOption) =>
    includeVectors || icon.kind !== "vector";
  if (search.length > 0) {
    return [
      {
        id: "search",
        label: "Search results",
        icons: ICON_GROUPS.flatMap((group) => group.icons)
          .filter(visible)
          .filter((icon) => matchIcon(icon, search)),
      },
    ];
  }
  const sections: IconSection[] = [];
  const favouritesIcons = favourites
    .map((value) => findIconByEmoji(value))
    .map(withoutVectors)
    .filter((icon): icon is IconOption => icon !== undefined)
    .filter(visible);
  if (favouritesIcons.length > 0) {
    sections.push({ id: "favourites", label: "Favourites", icons: favouritesIcons });
  }
  if (recent.length > 0) {
    sections.push({
      id: "recent",
      label: "Recently used",
      icons: recent
        .map((emoji) => findIconByEmoji(emoji))
        .map(withoutVectors)
        .filter((icon): icon is IconOption => icon !== undefined)
        .filter(visible),
    });
  }
  for (const group of ICON_GROUPS) {
    if (!includeVectors && group.id === "vectors") continue;
    sections.push({ id: group.id, label: group.label, icons: group.icons });
  }
  return sections;
}

export interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  vectors?: boolean;
}

export function IconPicker({
  value,
  onChange,
  label = "Icon",
  className = "",
  vectors = true,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [preview, setPreview] = useState(value);
  const [activeIndex, setActiveIndex] = useState(0);
  const gridRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const sections = useMemo(
    () => buildSections(recent, favourites, query, vectors),
    [recent, favourites, query, vectors],
  );

  const flat = useMemo(
    () => sections.flatMap((section) => section.icons),
    [sections],
  );

  const offsets = useMemo(() => {
    const map = new Map<string, number>();
    let cursor = 0;
    for (const section of sections) {
      map.set(section.id, cursor);
      cursor += section.icons.length;
    }
    return map;
  }, [sections]);

  const handleOpen = () => {
    const recents = readRecent();
    const favs = readFavourites();
    const atOpen = buildSections(recents, favs, "", vectors).flatMap(
      (section) => section.icons,
    );
    const idx = atOpen.findIndex((icon) => icon.emoji === value);
    setRecent(recents);
    setFavourites(favs);
    setQuery("");
    setPreview(value);
    setActiveIndex(idx < 0 ? 0 : idx);
    setOpen(true);
  };

  const handleSelect = (icon: IconOption) => {
    const next = [icon.emoji, ...recent.filter((r) => r !== icon.emoji)].slice(
      0,
      MAX_RECENT,
    );
    writeRecent(next);
    setRecent(next);
    onChange(icon.emoji);
    setOpen(false);
  };

  const handleToggleFavourite = (icon: IconOption) => {
    const next = favourites.includes(icon.emoji)
      ? favourites.filter((value) => value !== icon.emoji)
      : [icon.emoji, ...favourites].slice(0, MAX_FAVOURITES);
    writeFavourites(next);
    setFavourites(next);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const focusIndex = (index: number) => {
    const length = flat.length;
    if (length === 0) return;
    const clamped = Math.max(0, Math.min(length - 1, index));
    setActiveIndex(clamped);
    setPreview(flat[clamped].emoji);
    requestAnimationFrame(() => {
      const el = gridRefs.current[clamped];
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    });
  };

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (flat.length === 0) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusIndex(activeIndex + COLUMNS);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusIndex(activeIndex - COLUMNS);
        break;
      case "ArrowRight":
        event.preventDefault();
        focusIndex(activeIndex + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusIndex(activeIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusIndex(0);
        break;
      case "End":
        event.preventDefault();
        focusIndex(flat.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        handleSelect(flat[activeIndex]);
        break;
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusIndex(activeIndex);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (flat.length > 0) {
        handleSelect(flat[Math.min(activeIndex, flat.length - 1)]);
      }
    }
  };

  const haveResults = flat.length > 0;
  const currentLabel = labelForEmoji(value);

  return (
    <div className={className}>
      {label !== "" && (
        <span className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}. Current icon: ${currentLabel ?? (value ? "custom" : "none")}. Open the icon picker.`}
        onClick={handleOpen}
        className="flex h-11 w-full items-center gap-2.5 rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors duration-150 ease-premium hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus:outline-none"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canvas text-lg leading-none"
        >
          {value ? (
            <IconValue value={value} className="h-5 w-5 text-lg" />
          ) : (
            "—"
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink">
          {currentLabel ?? (value ? "Change icon" : "Choose icon")}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pick an icon"
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
            >
              Clear
            </button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div id="icon-picker-options" className="flex flex-col gap-4">
          <div
            aria-live="polite"
            className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-canvas/60 p-3.5"
          >
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface text-3xl shadow-sm"
            >
              {preview ? (
                <IconValue value={preview} className="h-8 w-8 text-3xl" />
              ) : (
                "—"
              )}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold tracking-tight text-ink">
                {labelForEmoji(preview) ?? (preview ? "Custom icon" : "No icon selected")}
              </p>
              <p className="mt-1 text-xs text-muted">
                Use the arrow keys to browse · Enter to pick
              </p>
            </div>
          </div>

          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="icon-picker-options"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              const first = buildSections(recent, favourites, next, vectors)
                .flatMap((section) => section.icons)[0];
              setQuery(next);
              setActiveIndex(0);
              setPreview(first ? first.emoji : value);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search icons, e.g. groceries, rent, gym…"
            className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-3 text-sm text-ink transition-colors placeholder:text-muted/50 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />

          {!haveResults && (
            <p className="text-sm text-muted">
              No icons match &ldquo;{query}&rdquo;. Try another word.
            </p>
          )}

          {sections.map((section) => {
            const start = offsets.get(section.id) ?? 0;
            return (
              <div key={section.id}>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {section.label}
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-border/70"
                  />
                </p>
                <div
                  role="listbox"
                  aria-label={section.label}
                  aria-activedescendant={
                    flat[Math.min(activeIndex, flat.length - 1)]
                      ? `icon-option-${activeIndex}`
                      : undefined
                  }
                  onKeyDown={handleGridKeyDown}
                  className="grid grid-cols-6 gap-1.5"
                >
                  {section.icons.map((icon, localIndex) => {
                    const index = start + localIndex;
                    const active = index === activeIndex;
                    const favourite = favourites.includes(icon.emoji);
                    return (
                      <div
                        key={`${section.id}:${icon.emoji}`}
                        className="relative"
                      >
                        <button
                          id={`icon-option-${index}`}
                          ref={(el) => {
                            gridRefs.current[index] = el;
                          }}
                          type="button"
                          role="option"
                          aria-selected={active}
                          aria-label={icon.label}
                          tabIndex={active ? 0 : -1}
                          onMouseEnter={() => setPreview(icon.emoji)}
                          onClick={() => handleSelect(icon)}
                          className={`flex h-11 w-full items-center justify-center rounded-lg border text-xl transition-all duration-150 ease-premium focus:outline-none ${
                            active
                              ? "border-brand-500/70 bg-brand-500/10 text-brand-700 shadow-sm dark:text-brand-300"
                              : "border-border/60 bg-surface text-ink hover:border-brand-500/40 hover:bg-canvas"
                          }`}
                        >
                          <IconValue
                            value={icon.emoji}
                            className="h-6 w-6 text-xl"
                          />
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`${
                            favourite ? "Unfavourite" : "Favourite"
                          } ${icon.label}`}
                          onClick={() => handleToggleFavourite(icon)}
                          className={`absolute right-0.5 top-0.5 rounded-full p-0.5 text-[11px] leading-none transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none ${
                            favourite
                              ? "text-amber-500"
                              : "text-muted/30 hover:text-amber-500"
                          }`}
                        >
                          <span aria-hidden="true">{favourite ? "★" : "☆"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}