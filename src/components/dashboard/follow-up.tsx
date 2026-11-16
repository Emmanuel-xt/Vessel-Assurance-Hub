import Link from "next/link";
import { ChevronRight, Clock, OctagonX, ShieldAlert, Sparkles } from "lucide-react";
import { RISK_BADGE } from "@/components/assess/findings/finding-style";
import { Badge } from "@/components/ui/badge";
import { formatCalendarDate, formatDate } from "@/lib/format";
import type { DashboardView, FailedCheckRow } from "@/lib/services/dashboard";
import { RISK_LABELS } from "@/lib/services/findings";
import { cn } from "@/lib/utils";

function ListCard({
  id,
  icon: Icon,
  title,
  total,
  shown,
  empty,
  tone,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  total: number;
  shown: number;
  empty: string;
  tone: "red" | "green";
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex min-w-0 scroll-mt-44 flex-col rounded-2xl border bg-card p-4">
      <h2 id={`${id}-title`} className="flex items-center gap-2 font-semibold">
        <Icon className={cn("size-5", tone === "red" ? "text-red-700" : "text-emerald-700")} aria-hidden />
        {title}
        <span className="ml-auto text-sm font-medium tabular-nums text-muted-foreground">{total}</span>
      </h2>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y">{children}</ul>
          {total > shown && <p className="pt-2 text-xs text-muted-foreground">Showing {shown} of {total}.</p>}
        </>
      )}
    </section>
  );
}

const rowLink = "flex items-start gap-2 rounded-lg py-2.5 hover:bg-muted min-h-11";

/** One failed Start Work Check: who, where, which items were No, and its activity. */
export function FailedCheckItem({ row }: { row: FailedCheckRow }) {
  return (
    <li className="py-1">
      <Link href={`/assessments/${row.assessmentId}`} className={rowLink}>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
            {row.moduleName} · {row.vesselName}
          </span>
          <span className="block text-xs text-muted-foreground">
            {row.reference} · {formatDate(row.submittedAt)} · {row.person}, {row.company}
          </span>
          <span className="block text-xs text-red-800">
            No: {row.noItems.slice(0, 2).join("; ")}
            {row.noItems.length > 2 && ` (+${row.noItems.length - 2} more)`}
          </span>
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {row.activity && (
        <Link
          href={`/start-work/${row.activity.id}`}
          className="-mt-1 inline-flex min-h-11 items-center text-xs font-medium text-teal hover:underline"
        >
          Start Work Check {row.activity.reference} · set up by {row.activity.createdByName}
        </Link>
      )}
    </li>
  );
}

/** Auditor: the lists behind the Overdue findings, Start Work STOPs and Good Practice cards. */
export function FollowUpLists({ view }: { view: DashboardView }) {
  const { overdue, stops, goodPractice } = view.followUp;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <ListCard
        id="follow-overdue"
        icon={Clock}
        title="Overdue findings"
        total={overdue.total}
        shown={overdue.rows.length}
        empty="Nothing overdue in this period."
        tone="red"
      >
        {overdue.rows.map((row) => (
          <li key={row.findingId}>
            <Link href={`/assessments/${row.assessmentId}`} className={rowLink}>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge className={RISK_BADGE[row.risk]}>{RISK_LABELS[row.risk]}</Badge>
                  {row.critical && (
                    <Badge className="bg-destructive/10 text-destructive">
                      <ShieldAlert /> Critical
                    </Badge>
                  )}
                  <span className="text-sm font-semibold text-red-700">{row.daysOverdue} days overdue</span>
                </span>
                <span className="block text-sm leading-snug">{row.description}</span>
                <span className="block text-xs text-muted-foreground">
                  {row.reference} · {row.vesselName}
                  {row.moduleName && ` · ${row.moduleName}`} · {row.ownerName}, due {formatCalendarDate(row.targetDate)}
                </span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ListCard>

      <ListCard
        id="follow-stops"
        icon={OctagonX}
        title="Start Work STOPs"
        total={stops.total}
        shown={stops.rows.length}
        empty="No STOPs in this period."
        tone="red"
      >
        {stops.rows.map((row) => (
          <FailedCheckItem key={row.assessmentId} row={row} />
        ))}
      </ListCard>

      <ListCard
        id="follow-good"
        icon={Sparkles}
        title="Good Practice"
        total={goodPractice.total}
        shown={goodPractice.rows.length}
        empty="No Good Practice recorded in this period."
        tone="green"
      >
        {goodPractice.rows.map((row) => (
          <li key={row.id}>
            <Link href={`/assessments/${row.assessmentId}`} className={rowLink}>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block text-sm leading-snug">{row.description}</span>
                <span className="block text-xs text-muted-foreground">
                  {row.vesselName}
                  {row.moduleName && ` · ${row.moduleName}`} · {row.recordedBy}, {formatDate(row.recordedAt)}
                </span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ListCard>
    </div>
  );
}
