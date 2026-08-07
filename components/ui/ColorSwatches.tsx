"use client";

export interface ColorSwatchOption {
  value: string;
  label: string;
  swatch?: string;
}

export function ColorSwatches({
  label,
  value,
  options,
  onChange,
  ringClassName = "ring-ink ring-offset-surface",
}: {
  label: string;
  value: string;
  options: ReadonlyArray<ColorSwatchOption>;
  onChange: (value: string) => void;
  ringClassName?: string;
}) {
  return (
    <div>
      <span className="mb-2.5 block text-sm font-semibold text-ink">
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={`h-8 w-8 rounded-full transition-transform duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus:outline-none motion-reduce:transition-none ${
                active
                  ? `scale-110 ring-2 ${ringClassName}`
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: option.swatch ?? option.value }}
            />
          );
        })}
      </div>
    </div>
  );
}
