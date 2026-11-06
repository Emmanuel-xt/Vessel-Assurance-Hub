"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Search, Ship } from "lucide-react";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface VesselOption {
  id: string;
  name: string;
  /** e.g. "PSV · EPC2" */
  detail: string;
}

interface VesselPickerProps {
  id: string;
  vessels: VesselOption[];
  value: string;
  onChange: (vesselId: string) => void;
  invalid?: boolean;
}

/** Searchable vessel dropdown. Opens a bottom sheet so it works one-handed on a phone. */
export function VesselPicker({ id, vessels, value, onChange, invalid }: VesselPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = vessels.find((v) => v.id === value);
  const term = search.trim().toLowerCase();
  const shown = vessels.filter((v) => !term || `${v.name} ${v.detail}`.toLowerCase().includes(term));

  function choose(vesselId: string) {
    onChange(vesselId);
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-describedby={invalid ? `${id}-error` : undefined}
        onClick={() => setOpen(true)}
        className={cn(
          INPUT_CLASS,
          "flex w-full items-center gap-2 rounded-lg border border-input px-2.5 text-left text-base outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring",
          invalid && "border-destructive ring-3 ring-destructive/20",
        )}
      >
        <Ship className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {selected ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{selected.name}</span>
            <span className="text-muted-foreground"> · {selected.detail}</span>
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">Choose a vessel</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl p-0">
          <SheetHeader className="pb-0">
            <SheetTitle>Choose a vessel</SheetTitle>
          </SheetHeader>
          <div className="relative px-4">
            <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search vessels"
              placeholder="Search name, type or package…"
              className={`${INPUT_CLASS} pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <ul role="listbox" aria-label="Vessels" className="flex-1 overflow-y-auto px-2 pb-4">
            {shown.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No vessels match.</li>}
            {shown.map((v) => (
              <li key={v.id} role="option" aria-selected={v.id === value}>
                <button
                  type="button"
                  onClick={() => choose(v.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{v.name}</span>
                    <span className="block text-xs text-muted-foreground">{v.detail}</span>
                  </span>
                  {v.id === value && <Check className="size-4 text-teal" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
