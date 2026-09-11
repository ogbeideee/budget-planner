"use client";

import type { ReactNode } from "react";
import {
  DatabaseIcon,
  GridIcon,
  InfoIcon,
  MailIcon,
  MonitorIcon,
  PaletteIcon,
  RepeatIcon,
  SlidersIcon,
  SparklesIcon,
  UserIcon,
  WalletIcon,
} from "@/components/ui/icons";

export type SettingsSection =
  | "profile"
  | "appearance"
  | "budget"
  | "categories"
  | "recurring"
  | "income"
  | "learning"
  | "email"
  | "desktop"
  | "data"
  | "about";

export const SETTINGS_SECTIONS: ReadonlyArray<{
  id: SettingsSection;
  label: string;
  icon: ReactNode;
}> = [
  { id: "profile", label: "Profile", icon: <UserIcon className="h-5 w-5" /> },
  {
    id: "appearance",
    label: "Appearance",
    icon: <PaletteIcon className="h-5 w-5" />,
  },
  {
    id: "budget",
    label: "Budget Preferences",
    icon: <SlidersIcon className="h-5 w-5" />,
  },
  {
    id: "categories",
    label: "Categories",
    icon: <GridIcon className="h-5 w-5" />,
  },
  {
    id: "recurring",
    label: "Recurring",
    icon: <RepeatIcon className="h-5 w-5" />,
  },
  {
    id: "income",
    label: "Income Sources",
    icon: <WalletIcon className="h-5 w-5" />,
  },
  {
    id: "learning",
    label: "Learned rules",
    icon: <SparklesIcon className="h-5 w-5" />,
  },
  {
    id: "email",
    label: "Email alerts",
    icon: <MailIcon className="h-5 w-5" />,
  },
  {
    id: "desktop",
    label: "Desktop",
    icon: <MonitorIcon className="h-5 w-5" />,
  },
  {
    id: "data",
    label: "Data & Backups",
    icon: <DatabaseIcon className="h-5 w-5" />,
  },
  { id: "about", label: "About", icon: <InfoIcon className="h-5 w-5" /> },
];

/** Sections to show in this build. "Desktop" is about the tray and the window
 *  close button, neither of which exists in a browser tab, and "email" needs
 *  the OS keychain and the main-process IMAP transport, so both are hidden
 *  there rather than shown with every control inert. */
export function visibleSettingsSections(
  desktop: boolean,
): ReadonlyArray<(typeof SETTINGS_SECTIONS)[number]> {
  return desktop
    ? SETTINGS_SECTIONS
    : SETTINGS_SECTIONS.filter(
        (section) => section.id !== "desktop" && section.id !== "email",
      );
}

export function SettingsNav({
  active,
  onSelect,
  sections = SETTINGS_SECTIONS,
}: {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  sections?: ReadonlyArray<(typeof SETTINGS_SECTIONS)[number]>;
}) {
  return (
    <nav aria-label="Settings sections" className="flex w-full flex-col gap-1">
      {sections.map((section) => {
        const selected = section.id === active;
        return (
          <button
            key={section.id}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onSelect(section.id)}
            className={`relative flex h-12 w-full items-center gap-3 rounded-xl px-3.5 text-base font-semibold transition-all duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus:outline-none ${
              selected
                ? "bg-brand-500/[0.08] text-brand-700 dark:text-brand-300"
                : "text-muted hover:bg-sidebar-hover hover:text-ink"
            }`}
          >
            {selected && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand-500"
              />
            )}
            <span aria-hidden="true" className={selected ? "" : "text-muted/70"}>
              {section.icon}
            </span>
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
