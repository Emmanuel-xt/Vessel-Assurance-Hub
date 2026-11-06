"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToggleChipsProps {
  id: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Read out when nothing is selected, e.g. "All vessel types". */
  emptyLabel: string;
  invalid?: boolean;
}

/** Multi-select as tappable chips: large touch targets, no dropdown to fight with on a phone. */
export function ToggleChips({ id, options, selected, onChange, emptyLabel, invalid }: ToggleChipsProps) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div
      id={id}
      role="group"
      aria-describedby={invalid ? `${id}-error` : undefined}
      className="space-y-2"
    >
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(option.value)}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                on ? "border-teal bg-accent font-medium text-accent-foreground" : "hover:bg-muted",
              )}
            >
              {on && <Check className="size-3.5" aria-hidden />}
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length === 0 ? `${emptyLabel} (none selected)` : `${selected.length} selected`}
        {selected.length > 0 && (
          <>
            {" · "}
            <button type="button" className="inline-flex min-h-11 items-center font-medium text-teal underline-offset-4 hover:underline" onClick={() => onChange([])}>
              Clear (apply to all)
            </button>
          </>
        )}
      </p>
    </div>
  );
}
