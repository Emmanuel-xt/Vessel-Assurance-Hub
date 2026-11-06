"use client";

import { CheckCircle2, ChevronDown } from "lucide-react";
import { ModuleIcon } from "@/components/hub/module-icon";
import type { Module } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ModuleSectionProps {
  module: Module;
  answered: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Collapsible module group for Full Vessel Assurance. */
export function ModuleSection({ module, answered, total, open, onToggle, children }: ModuleSectionProps) {
  const complete = total > 0 && answered === total;
  const panelId = `section-${module.id}`;
  return (
    <section className="rounded-2xl border bg-muted/30">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ModuleIcon moduleId={module.id} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{module.name}</span>
            <span className={cn("block text-xs", complete ? "text-emerald-700" : "text-muted-foreground")}>
              {total === 0 ? "No questions apply" : `${answered} of ${total} answered`}
            </span>
          </span>
          {complete && <CheckCircle2 className="size-5 text-emerald-600" aria-label="Complete" />}
          <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="space-y-3 px-2 pb-3 sm:px-3">
        {children}
      </div>
    </section>
  );
}
