"use client";

import { AlertTriangle, CalendarClock, ClipboardX, Pencil, ShieldAlert, UserRound } from "lucide-react";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { useRepoQuery } from "@/lib/data/hooks";
import { formatCalendarDate } from "@/lib/format";
import { RISK_LABELS, listAssessmentFindings } from "@/lib/services/findings";
import type { FindingDraft, ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RISK_BADGE, RISK_BORDER } from "./finding-style";

/** A finding prepared on a draft, with an Edit button. */
export function PendingFindingCard({
  draft,
  ownerName,
  onEdit,
  note,
  label = "Finding",
}: {
  draft: FindingDraft;
  ownerName: string;
  onEdit: () => void;
  /** e.g. "The answer is no longer No…" */
  note?: string;
  label?: string;
}) {
  return (
    <div className={cn("space-y-1.5 rounded-xl border border-l-4 bg-background p-3", RISK_BORDER[draft.risk])}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ClipboardX className="size-3.5" aria-hidden /> {label}
            <Badge className={RISK_BADGE[draft.risk]}>{RISK_LABELS[draft.risk]} risk</Badge>
          </p>
          <p className="line-clamp-2 text-sm">{draft.description}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full border px-4 text-sm hover:bg-muted"
        >
          <Pencil className="size-3.5" aria-hidden /> Edit
        </button>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5" aria-hidden /> {ownerName}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden /> due {formatCalendarDate(draft.targetDate)}
        </span>
      </p>
      {note && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {note}
        </p>
      )}
    </div>
  );
}

/** Findings recorded against a submitted assessment, with their actions. */
export function RaisedFindings({ assessmentId, title = "Findings raised" }: { assessmentId: ID; title?: string }) {
  const user = useCurrentUser();
  const query = useRepoQuery(["findings", "assessment", assessmentId], () => listAssessmentFindings(user, assessmentId));
  const list = query.data ?? [];
  if (query.isPending || list.length === 0) return null;

  return (
    <section className="space-y-2" aria-labelledby="raised-findings-heading">
      <h2 id="raised-findings-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({list.length})
      </h2>
      <ul className="space-y-2">
        {list.map(({ finding, actions }) => (
          <li key={finding.id} className={cn("space-y-2 rounded-xl border border-l-4 bg-card p-3", RISK_BORDER[finding.risk])}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-sm font-semibold text-teal">{finding.reference}</span>
              <Badge className={RISK_BADGE[finding.risk]}>{RISK_LABELS[finding.risk]} risk</Badge>
              {finding.critical && (
                <Badge className="bg-destructive/10 text-destructive">
                  <ShieldAlert /> Critical
                </Badge>
              )}
            </div>
            <p className="text-sm">{finding.description}</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {actions.map((action) => (
                <li key={action.id} className="flex flex-wrap gap-x-3">
                  <span className="font-mono">{action.reference.slice(finding.reference.length + 1)}</span>
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3.5" aria-hidden /> {action.ownerName}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" aria-hidden /> due {formatCalendarDate(action.targetDate)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
