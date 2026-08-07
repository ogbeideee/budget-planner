"use client";

import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { ColorSwatches } from "@/components/ui/ColorSwatches";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAppearance } from "@/hooks/useAppearance";
import { ACCENTS } from "@/lib/theme";

export function AppearancePanel() {
  const { accent, animations, setAccent, setAnimations } = useAppearance();

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Theme"
        subtitle="Choose how the app looks. System follows your device setting."
      >
        <ThemeToggle variant="cards" />
      </Card>

      <Card
        title="Accent color"
        subtitle="Accent tints buttons, selections, and highlights throughout the app."
      >
        <ColorSwatches
          label="Accent"
          value={accent}
          ringClassName="ring-white ring-offset-2 ring-offset-surface dark:ring-ink"
          options={ACCENTS.map((option) => ({
            value: option.value,
            label: option.label,
            swatch: option.swatch,
          }))}
          onChange={(value) => setAccent(value as (typeof ACCENTS)[number]["value"])}
        />
        <p className="mt-3 text-sm text-muted">
          {ACCENTS.find((option) => option.value === accent)?.label} is
          active.
        </p>
      </Card>

      <Card
        title="Motion"
        subtitle="Reduce animations, transitions, and entrance effects."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink">
              Reduce animations
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Disables entrance animations, hover transitions, and motion
              effects across the whole app.
            </p>
          </div>
          <Switch
            checked={animations === "off"}
            label="Reduce animations"
            onChange={(checked) => setAnimations(checked ? "off" : "on")}
          />
        </div>
      </Card>
    </div>
  );
}
