"use client";

import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";

export function BudgetPreferencesPanel() {
  const currency = useAppStore((s) => s.state.settings.currency);
  const recurringEnabled = useAppStore((s) => s.state.settings.recurringEnabled);
  const setSettings = useAppStore((s) => s.setSettings);
  const { success } = useToast();

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Currency"
        subtitle="Used to format every amount in the app."
      >
        <div className="max-w-xs">
          <Select
            label="Default currency"
            value={currency}
            options={[
              { value: "USD", label: "US Dollar ($)" },
              { value: "NGN", label: "Nigerian Naira (₦)" },
            ]}
            onChange={(event) => {
              setSettings({
                currency: event.target.value as "USD" | "NGN",
              });
              success("Currency updated.");
            }}
          />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Display only. Existing values are re-labelled; nothing is
          converted.
        </p>
      </Card>

      <Card
        title="Recurring transactions"
        subtitle="Rules generate repeating transactions so budgets stay accurate."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink">
              Auto-generate recurring transactions
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Recurring rules create their transactions automatically each
              month, so your budgets stay accurate.
            </p>
          </div>
          <Switch
            checked={recurringEnabled}
            label="Generate recurring transactions automatically"
            onChange={(checked) => {
              setSettings({ recurringEnabled: checked });
              success(
                checked
                  ? "Recurring generation enabled."
                  : "Recurring generation disabled.",
              );
            }}
          />
        </div>
      </Card>
    </div>
  );
}
