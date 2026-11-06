import Link from "next/link";
import { ChevronRight, ClipboardX, Play, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { ScoreValue } from "@/components/assess/score-value";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { AssessmentRow } from "@/lib/services/assessment-lists";
import { cn } from "@/lib/utils";

function RowText({ row, showSubmitter }: { row: AssessmentRow; showSubmitter?: boolean }) {
  const { assessment: a } = row;
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-teal">{a.reference}</span>
        {a.status === "DRAFT" && <StatusBadge status="DRAFT" />}
        {row.openFindings > 0 && (
          <Badge className="bg-red-50 text-red-800">
            <ClipboardX /> {row.openFindings} open finding{row.openFindings === 1 ? "" : "s"}
          </Badge>
        )}
      </div>
      <p className="font-medium">
        {row.title}
        {row.subtitle && <span className="font-normal text-muted-foreground"> · {row.subtitle}</span>}
      </p>
      {a.startWork && <p className="truncate text-sm text-muted-foreground">{a.startWork.taskDescription}</p>}
      <p className="text-xs text-muted-foreground">
        {a.snapshot.vesselName} · {row.locationName} · {row.auditTypeName}
      </p>
      <p className="text-xs text-muted-foreground">
        {a.status === "DRAFT" ? `Last edited ${formatDate(a.updatedAt)}` : `Submitted ${formatDate(a.submittedAt!)}`}
        {showSubmitter && ` · ${a.snapshot.userName} (${a.snapshot.company})`}
      </p>
    </div>
  );
}

/** A submitted assessment: the whole row opens the detail page. */
export function SubmittedRow({ row, showSubmitter }: { row: AssessmentRow; showSubmitter?: boolean }) {
  const score = row.assessment.overallScore;
  return (
    <li>
      <Link
        href={`/assessments/${row.assessment.id}`}
        className="flex items-center gap-3 p-4 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <RowText row={row} showSubmitter={showSubmitter} />
        <ScoreValue score={score} className="text-xl" />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/** A draft: Resume opens the form; Delete asks first. */
export function DraftRow({ row, onDelete }: { row: AssessmentRow; onDelete: () => void }) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <RowText row={row} />
      <div className="flex gap-2">
        <Link href={`/assess/${row.assessment.id}`} className={cn(buttonVariants(), "h-11 flex-1 px-4 sm:flex-none")}>
          <Play /> Resume
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className={cn(buttonVariants({ variant: "destructive" }), "h-11 px-4")}
          aria-label={`Delete draft ${row.assessment.reference}`}
        >
          <Trash2 /> <span className="sm:sr-only">Delete</span>
        </button>
      </div>
    </li>
  );
}
