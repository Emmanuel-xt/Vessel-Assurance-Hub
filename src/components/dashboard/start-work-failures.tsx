"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Info, ShieldAlert } from "lucide-react";
import { ModuleIcon } from "@/components/hub/module-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FAILURE_BANDS,
  startWorkTrace,
  type DrillDown,
  type FailureRow,
  type PreparedData,
  type StartWorkFailures as Failures,
  type StartWorkTaskRow,
} from "@/lib/services/dashboard";
import type { ScoreBand } from "@/lib/services/scoring";
import type { Assessment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BAND_FILL } from "./chart-card";
import { FailedCheckItem } from "./follow-up";

const BAND_TEXT: Record<ScoreBand, string> = {
  red: "text-red-700",
  amber: "text-amber-700",
  green: "text-emerald-700",
  none: "text-muted-foreground",
};

/** Items marked N/A this often are listed so overuse is visible. */
const NA_WATCH_SHARE = 30;

const pct = (v: number | null) => (v === null ? "n/a" : `${v}%`);

function FailureBar({ row, label }: { row: FailureRow; label: string }) {
  return (
    <span className="block h-2 rounded-full bg-muted" role="img" aria-label={label}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(row.failureRate ?? 0, row.failed > 0 ? 3 : 0)}%`, background: BAND_FILL[row.band] }}
      />
    </span>
  );
}

/**
 * Admin and Auditor: how often each Start Work task stops (any No), and where the STOPs come from (items, vessels,
 * checks). N/A never counts as a pass or a fail.
 */
export function StartWorkFailures({
  data,
  assessments,
  failures,
  link,
  onVessel,
}: {
  data: PreparedData;
  assessments: Assessment[];
  failures: Failures;
  link: (extra?: DrillDown) => string;
  onVessel: (vesselId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section aria-labelledby="swc-failures-title" className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="swc-failures-title" className="font-semibold">
            Start Work Check failures
          </h2>
          <p className="text-sm">
            {failures.checks === 0 ? (
              "No Start Work Checks in this selection."
            ) : (
              <>
                <span className={cn("font-semibold", BAND_TEXT[failures.band])}>{pct(failures.failureRate)}</span> of checks
                stopped ({failures.failed} of {failures.checks}). A check stops when any item is answered No.
              </>
            )}
          </p>
        </div>
        <Link
          href={link({ auditTypeId: "at-start-work-check" })}
          className="-mx-2 inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-teal hover:bg-muted"
        >
          View checks <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        N/A answers are left out: they never pass or fail a check. Colours: up to {FAILURE_BANDS.green}% green, up to{" "}
        {FAILURE_BANDS.amber}% amber, above that red. Tap a task to see where its STOPs come from.
      </p>

      {failures.tasks.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {failures.tasks.map((task) => (
            <TaskRow
              key={task.moduleId}
              task={task}
              open={open === task.moduleId}
              onToggle={() => setOpen((v) => (v === task.moduleId ? null : task.moduleId))}
            >
              {open === task.moduleId && (
                <Trace data={data} assessments={assessments} moduleId={task.moduleId} link={link} onVessel={onVessel} />
              )}
            </TaskRow>
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskRow({
  task,
  open,
  onToggle,
  children,
}: {
  task: StartWorkTaskRow;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = `trace-${task.moduleId}`;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <ModuleIcon moduleId={task.moduleId} className="size-5 text-navy" />
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{task.name}</span>
            <span className={cn("shrink-0 text-sm font-semibold tabular-nums", BAND_TEXT[task.band])}>
              {pct(task.failureRate)} stopped
            </span>
          </span>
          <FailureBar row={task} label={`${task.name}: ${pct(task.failureRate)} of checks stopped`} />
          <span className="block text-xs text-muted-foreground">
            {task.failed} of {task.checks} checks · No on {pct(task.noRate)} of answers · N/A {pct(task.naShare)}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div id={panelId}>{children}</div>
    </li>
  );
}

function Trace({
  data,
  assessments,
  moduleId,
  link,
  onVessel,
}: {
  data: PreparedData;
  assessments: Assessment[];
  moduleId: string;
  link: (extra?: DrillDown) => string;
  onVessel: (vesselId: string) => void;
}) {
  const trace = useMemo(() => startWorkTrace(data, assessments, moduleId), [data, assessments, moduleId]);
  const [allChecks, setAllChecks] = useState(false);
  const stopping = trace.items.filter((i) => i.stops > 0);
  const naWatch = trace.items.filter((i) => i.na >= 2 && (i.naShare ?? 0) >= NA_WATCH_SHARE);
  const checks = allChecks ? trace.failedChecks : trace.failedChecks.slice(0, 5);

  if (trace.failed === 0) {
    return (
      <div className="border-t bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
        No {trace.name} check stopped in this selection ({trace.checks} checks).
        {naWatch.length > 0 && <NaWatch items={naWatch} checks={trace.checks} />}
      </div>
    );
  }

  return (
    <div className="space-y-5 border-t bg-muted/30 px-3 py-4">
      <div>
        <h3 className="text-sm font-semibold">Items that stopped work</h3>
        <p className="text-xs text-muted-foreground">How many of the {trace.failed} STOPs each item caused (a check can fail on more than one).</p>
        <ol className="mt-2 divide-y rounded-xl border bg-card">
          {stopping.map((item) => (
            <li key={item.questionId} className="space-y-1.5 px-3 py-2.5">
              <p className="text-sm leading-snug">{item.text}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {item.critical && (
                  <Badge className="bg-destructive/10 text-destructive">
                    <ShieldAlert /> Critical
                  </Badge>
                )}
                <span className="font-semibold text-red-700">
                  Caused {item.stops} of {trace.failed} STOPs ({pct(item.stopShare)})
                </span>
                <span className="text-muted-foreground">
                  No {pct(item.noRate)} · N/A {pct(item.naShare)}
                </span>
              </div>
              <span className="block h-1.5 rounded-full bg-muted">
                <span className="block h-full rounded-full bg-red-500" style={{ width: `${item.stopShare ?? 0}%` }} />
              </span>
              <Link
                href={link({ questionId: item.questionId })}
                className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-teal hover:underline"
              >
                See these checks <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
        {naWatch.length > 0 && <NaWatch items={naWatch} checks={trace.checks} />}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Where</h3>
        <p className="text-xs text-muted-foreground">Share of {trace.name} checks stopped per vessel. Tap one to filter the dashboard.</p>
        <ul className="mt-2 space-y-1">
          {trace.vessels.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onVessel(v.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <span className="w-32 shrink-0 truncate text-sm">{v.name}</span>
                <span className="min-w-0 flex-1">
                  <FailureBar row={v} label={`${v.name}: ${pct(v.failureRate)} stopped`} />
                </span>
                <span className={cn("w-24 shrink-0 text-right text-xs tabular-nums", BAND_TEXT[v.band])}>
                  {v.failed} of {v.checks} · {pct(v.failureRate)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Failed checks</h3>
        <p className="text-xs text-muted-foreground">Newest first. Open a check, or the Start Work Check it belongs to.</p>
        <ul className="mt-1 divide-y rounded-xl border bg-card px-3">
          {checks.map((row) => (
            <FailedCheckItem key={row.assessmentId} row={row} />
          ))}
        </ul>
        {trace.failedChecks.length > 5 && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setAllChecks((v) => !v)}>
            {allChecks ? "Show fewer" : `Show ${trace.failedChecks.length - 5} more`}
          </Button>
        )}
        {trace.failed > trace.failedChecks.length && (
          <p className="pt-2 text-xs text-muted-foreground">
            The {trace.failedChecks.length} newest of {trace.failed}. Narrow the date range to see older ones.
          </p>
        )}
      </div>
    </div>
  );
}

function NaWatch({ items, checks }: { items: { questionId: string; text: string; na: number; naShare: number | null }[]; checks: number }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
      <p className="text-xs font-semibold">Often marked N/A</p>
      <p className="text-xs">Left out of the numbers above. Worth checking these really did not apply.</p>
      <ul className="mt-1.5 space-y-1 text-xs">
        {items.map((i) => (
          <li key={i.questionId}>
            {i.text} <span className="font-semibold">({i.na} of {checks} checks, {pct(i.naShare)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
