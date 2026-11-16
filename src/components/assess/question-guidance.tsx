"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { parseGuidance } from "@/lib/guidance";
import { cn } from "@/lib/utils";

/** "How to check" toggle under a question: the Start Work sheets' "How to (examples)" guidance. */
export function QuestionGuidance({ questionId, guidance }: { questionId: string; guidance: string }) {
  const [open, setOpen] = useState(false);
  const lines = parseGuidance(guidance);
  if (lines.length === 0) return null;
  const panelId = `guidance-${questionId}`;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-teal hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <Info className="size-4" aria-hidden />
        How to check
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="mt-1 space-y-1.5 rounded-xl bg-muted/60 p-3 text-sm">
          <ul className="space-y-1">
            {lines
              .filter((l) => l.kind !== "note")
              .map((line, i) => (
                <li key={i} className={cn("flex gap-2", line.kind === "sub" && "pl-5 text-muted-foreground")}>
                  <span aria-hidden className="select-none">
                    {line.kind === "sub" ? "–" : "•"}
                  </span>
                  <span>{line.text}</span>
                </li>
              ))}
          </ul>
          {lines
            .filter((l) => l.kind === "note")
            .map((line, i) => (
              <p key={i} className="border-l-2 border-amber-500 pl-2 text-amber-950">
                <span className="font-semibold">Note: </span>
                {line.text}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
