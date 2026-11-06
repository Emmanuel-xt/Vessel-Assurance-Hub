"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCalendarDate } from "@/lib/format";
import {
  DATE_PRESETS,
  PRESET_LABELS,
  SCOPE_LABELS,
  type DashboardData,
  type DashboardFilter,
  type Period,
  type Scope,
} from "@/lib/services/dashboard";
import { cn } from "@/lib/utils";

type DimensionKey = "vesselId" | "locationId" | "packageId" | "moduleId" | "auditTypeId";

const DIMENSIONS: { key: DimensionKey; label: string; source: (d: DashboardData) => { id: string; name: string }[] }[] = [
  { key: "vesselId", label: "Vessel", source: (d) => [...d.vessels].sort((a, b) => a.name.localeCompare(b.name)) },
  { key: "locationId", label: "Location", source: (d) => [...d.locations].sort((a, b) => a.name.localeCompare(b.name)) },
  { key: "packageId", label: "Package", source: (d) => [...d.packages].sort((a, b) => a.name.localeCompare(b.name)) },
  { key: "moduleId", label: "Module", source: (d) => [...d.modules].sort((a, b) => a.displayOrder - b.displayOrder) },
  { key: "auditTypeId", label: "Audit type", source: (d) => [...d.auditTypes].sort((a, b) => a.displayOrder - b.displayOrder) },
];

interface FilterBarProps {
  filter: DashboardFilter;
  period: Period;
  data: DashboardData;
  onChange: (patch: Partial<DashboardFilter>) => void;
  onReset: () => void;
}

/** Sticky under the top bar. Date range and Self/Supervisory always visible; other filters inline (desktop) or in a sheet (phone). */
export function FilterBar({ filter, period, data, onChange, onReset }: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = DIMENSIONS.filter((d) => filter[d.key]);
  const nameOf = (key: DimensionKey, id: string) => DIMENSIONS.find((d) => d.key === key)!.source(data).find((x) => x.id === id)?.name ?? id;

  const dimensionSelects = (idPrefix: string) =>
    DIMENSIONS.map(({ key, label, source }) => (
      <div key={key} className="min-w-0 space-y-1">
        <Label htmlFor={`${idPrefix}-${key}`} className="text-xs">
          {label}
        </Label>
        <NativeSelect id={`${idPrefix}-${key}`} value={filter[key] ?? ""} onChange={(e) => onChange({ [key]: e.target.value || undefined })}>
          <option value="">All</option>
          {source(data).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    ));

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur print:hidden">
      <div className="flex flex-wrap items-end gap-2">
        {/* Phone: [range ▾][Filters] then a full-width Self/Supervisory switch. Labels are visible from sm up. */}
        <div className="min-w-40 flex-1 space-y-1 sm:flex-none">
          <Label htmlFor="dash-range" className="text-xs max-sm:sr-only">
            Date range
          </Label>
          <NativeSelect
            id="dash-range"
            value={filter.preset}
            onChange={(e) => {
              const preset = e.target.value as DashboardFilter["preset"];
              onChange(preset === "custom" ? { preset, from: period.from, to: period.to } : { preset, from: undefined, to: undefined });
            }}
            className="sm:w-40"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <Button variant="outline" className="h-11 sm:order-last md:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal /> Filters{active.length > 0 && ` (${active.length})`}
        </Button>

        {filter.preset === "custom" && (
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="flex-1 space-y-1">
              <Label htmlFor="dash-from" className="text-xs">
                From
              </Label>
              <Input
                id="dash-from"
                type="date"
                className={INPUT_CLASS}
                value={filter.from ?? period.from}
                max={filter.to}
                onChange={(e) => e.target.value && onChange({ from: e.target.value })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="dash-to" className="text-xs">
                To
              </Label>
              <Input
                id="dash-to"
                type="date"
                className={INPUT_CLASS}
                value={filter.to ?? period.to}
                min={filter.from}
                onChange={(e) => e.target.value && onChange({ to: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="w-full space-y-1 sm:w-auto">
          <p id="dash-scope-label" className="text-xs font-medium max-sm:sr-only">
            Self vs Supervisory
          </p>
          <div role="radiogroup" aria-labelledby="dash-scope-label" className="grid grid-cols-3 rounded-lg border p-0.5 sm:flex">
            {(Object.keys(SCOPE_LABELS) as Scope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                role="radio"
                aria-checked={filter.scope === scope}
                onClick={() => onChange({ scope })}
                className={cn(
                  "min-h-11 rounded-md px-3 text-sm font-medium transition-colors",
                  filter.scope === scope ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {SCOPE_LABELS[scope]}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 grid-cols-5 gap-2 md:grid">{dimensionSelects("dash")}</div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
        <span className="text-muted-foreground">
          {formatCalendarDate(period.from)} – {formatCalendarDate(period.to)}
        </span>
        {active.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ [key]: undefined })}
            className="group inline-flex min-h-11 items-center"
            aria-label={`Remove ${label} filter: ${nameOf(key, filter[key]!)}`}
          >
            <span className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 font-medium text-accent-foreground group-hover:bg-accent/80">
              {label}: {nameOf(key, filter[key]!)} <X className="size-3.5" aria-hidden />
            </span>
          </button>
        ))}
        {(active.length > 0 || filter.scope !== "all" || filter.preset !== "thisYear") && (
          <button type="button" onClick={onReset} className="min-h-11 px-2 font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Reset all
          </button>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85vh] w-full max-w-lg rounded-t-2xl p-0">
          <SheetHeader className="pb-0">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 overflow-y-auto px-4">{dimensionSelects("dash-sheet")}</div>
          <SheetFooter className="pb-[max(env(safe-area-inset-bottom),1rem)]">
            <Button className="h-12 text-base" onClick={() => setSheetOpen(false)}>
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
