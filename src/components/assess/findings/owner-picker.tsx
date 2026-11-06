"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Search, UserRound } from "lucide-react";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AssignableUser } from "@/lib/services/findings";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OwnerPickerProps {
  id: string;
  users: AssignableUser[];
  value: ID;
  onChange: (userId: ID) => void;
  /** Shown as "(you)" next to the signed-in user. */
  currentUserId: ID;
  invalid?: boolean;
}

/** Searchable list of active users in a bottom sheet (name, position or company). */
export function OwnerPicker({ id, users, value, onChange, currentUserId, invalid }: OwnerPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = users.find((u) => u.id === value);
  const term = search.trim().toLowerCase();
  const shown = users.filter((u) => !term || `${u.name} ${u.position} ${u.company}`.toLowerCase().includes(term));
  const you = (userId: ID) => (userId === currentUserId ? " (you)" : "");

  function choose(userId: ID) {
    onChange(userId);
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
        <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {selected ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">
              {selected.name}
              {you(selected.id)}
            </span>
            <span className="text-muted-foreground"> · {selected.position}</span>
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">Choose an owner</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl p-0">
          <SheetHeader className="pb-0">
            <SheetTitle>Who owns the action?</SheetTitle>
          </SheetHeader>
          <div className="relative px-4">
            <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search people"
              placeholder="Search name, position or company…"
              className={`${INPUT_CLASS} pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <ul role="listbox" aria-label="People" className="flex-1 overflow-y-auto px-2 pb-4">
            {shown.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Nobody matches.</li>}
            {shown.map((u) => (
              <li key={u.id} role="option" aria-selected={u.id === value}>
                <button
                  type="button"
                  onClick={() => choose(u.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {u.name}
                      {you(u.id)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {u.position} · {u.company}
                    </span>
                  </span>
                  {u.id === value && <Check className="size-4 text-teal" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
