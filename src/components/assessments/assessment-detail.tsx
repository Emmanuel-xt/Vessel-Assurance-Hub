"use client";

import Link from "next/link";
import { BackLink } from "@/components/admin/page-header";
import { useParams } from "next/navigation";
import {
  CalendarClock,
  ClipboardX,
  MessageSquare,
  Play,
  Printer,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { ANSWER_STYLES } from "@/components/assess/answer-style";
import { ScoreValue } from "@/components/assess/score-value";
import { RISK_BADGE, RISK_BORDER } from "@/components/assess/findings/finding-style";
import { PhotoThumbnails } from "@/components/assess/photos";
import { ScorePanel } from "@/components/assess/score-panel";
import { StartWorkDetailsLine, StopWorkBanner } from "@/components/assess/start-work";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { useRepoQuery } from "@/lib/data/hooks";
import { formatCalendarDate, formatDate, formatDateTime } from "@/lib/format";
import { loadAssessmentDetail, type AssessmentDetail } from "@/lib/services/assessment-lists";
import { KIND_LABELS, TAG_LABELS, answerLongLabelsFor } from "@/lib/services/assessments";
import { RISK_LABELS, type RaisedFinding } from "@/lib/services/findings";
import { isOverdue } from "@/lib/services/overdue";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";

/** /assessments/[id]: read-only record of an assessment, printable. */
export function AssessmentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const query = useRepoQuery(["assessments", id, "detail"], () => loadAssessmentDetail(user, id), {
    refetchOnMount: "always",
  });
  return (
    <QueryState query={query} skeletonRows={5} notFound="assessment">
      {(detail) => <Detail detail={detail} />}
    </QueryState>
  );
}

function Detail({ detail }: { detail: AssessmentDetail }) {
  const user = useCurrentUser();
  const { assessment: a, sections, findings } = detail;
  const submitted = a.status === "SUBMITTED";
  const labels = answerLongLabelsFor(a.kind);
  const multiModule = sections.length > 1;
  const findingByResponse = new Map(findings.flatMap((f) => (f.finding.responseId ? [[f.finding.responseId, f] as const] : [])));
  const items = sections.flatMap((s) => s.items);
  const noItems = items.filter((i) => i.response?.answer === "NO").map((i) => ({ id: i.questionId, text: i.text }));
  const commentsByQuestion: Record<ID, { comment: string } | undefined> = Object.fromEntries(
    items.map((i) => [i.questionId, i.response ? { comment: i.response.comment } : undefined]),
  );

  return (
    <article className="mx-auto max-w-3xl space-y-6 print:max-w-none print:space-y-4 print:text-[10pt]">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink href="/assessments" label="Assessments" />
        <div className="flex gap-2">
          {detail.editable && (
            <Link href={`/assess/${a.id}`} className={cn(buttonVariants(), "h-11 px-4")}>
              <Play /> Continue draft
            </Link>
          )}
          <Button variant="outline" className="h-11 px-4" onClick={() => window.print()}>
            <Printer /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <header className="space-y-3">
        <p className="hidden text-xs text-muted-foreground print:block">{APP_NAME} · assessment record</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-teal">{a.reference}</span>
          <StatusBadge status={a.status} />
          <span className="text-xs text-muted-foreground">{KIND_LABELS[a.kind]}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight print:text-xl">
          {detail.title}
          {detail.subtitle && <span className="font-normal text-muted-foreground"> · {detail.subtitle}</span>}
        </h1>
        {a.startWork && <StartWorkDetailsLine details={a.startWork} />}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-2 print:grid-cols-3 print:rounded-none print:border-x-0 print:px-0">
          <Info label="Vessel" value={`${a.snapshot.vesselName} · ${detail.packageName}`} />
          <Info label="Location" value={detail.locationName} />
          <Info label="Audit type" value={detail.auditTypeName} />
          <Info label="Assessed by" value={`${a.snapshot.userName}, ${a.snapshot.position}`} />
          <Info label="Company" value={a.snapshot.company} />
          <Info
            label={submitted ? "Submitted" : "Started"}
            value={submitted ? formatDateTime(a.submittedAt!) : formatDateTime(a.createdAt)}
          />
          {multiModule && <Info label="Modules" value={sections.map((s) => s.module.name).join(", ")} wide />}
        </dl>
      </header>

      {submitted ? (
        <ScorePanel scores={{ overall: a.overallScore, byModule: a.moduleScores }} sections={sections} />
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Draft in progress: not scored yet. Questions shown are the ones that apply today.
        </p>
      )}

      {submitted && a.kind === "START_WORK" && <StopWorkBanner items={noItems} responses={commentsByQuestion} />}

      {submitted && <FindingsSection findings={findings} />}

      {detail.positiveInterventionCount > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Sparkles className="size-4" aria-hidden />
          {detail.positiveInterventionCount} Good Practice observation{detail.positiveInterventionCount === 1 ? "" : "s"}{" "}
          recorded.
        </p>
      )}

      <section className="space-y-4" aria-labelledby="answers-heading">
        <h2 id="answers-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Answers
        </h2>
        {sections.map((section) => {
          const moduleScore = a.moduleScores[section.module.id] ?? null;
          return (
            <section key={section.module.id} className="space-y-2">
              {multiModule && (
                <h3 className="flex items-baseline justify-between gap-3 break-after-avoid text-base font-semibold">
                  {section.module.name}
                  {submitted && (
                    <ScoreValue score={moduleScore} layout="inline" className="text-sm" />
                  )}
                </h3>
              )}
              {section.items.length === 0 ? (
                <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No questions applied.</p>
              ) : (
                <ol className="divide-y rounded-2xl border bg-card print:rounded-none">
                  {section.items.map((item) => {
                    const response = item.response;
                    const finding = response ? findingByResponse.get(response.id) : undefined;
                    return (
                      <li key={item.questionId} id={`q-${item.questionId}`} className="space-y-1.5 p-3 break-inside-avoid">
                        <div className="flex items-start gap-3">
                          <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">Q{item.number}</span>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm">{item.text}</p>
                            {item.criticalControl && (
                              <Badge className="bg-destructive/10 text-destructive">
                                <ShieldAlert /> Critical control
                              </Badge>
                            )}
                          </div>
                          {response ? (
                            <Badge className={cn("shrink-0", ANSWER_STYLES[response.answer])}>{labels[response.answer]}</Badge>
                          ) : (
                            <Badge className="shrink-0 bg-muted text-muted-foreground">Not answered</Badge>
                          )}
                        </div>
                        {response?.comment && (
                          <p className="ml-10 flex gap-1.5 text-sm text-muted-foreground">
                            <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {response.comment}
                          </p>
                        )}
                        {response?.observationTag && (
                          <p className="ml-10">
                            <Badge
                              className={
                                response.observationTag === "GOOD_PRACTICE" ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800"
                              }
                            >
                              {response.observationTag === "GOOD_PRACTICE" ? <Sparkles /> : <TrendingUp />}
                              {TAG_LABELS[response.observationTag]}
                            </Badge>
                          </p>
                        )}
                        {response && response.photoIds.length > 0 && (
                          <div className="ml-10">
                            <PhotoThumbnails photoIds={response.photoIds} size="sm" />
                          </div>
                        )}
                        {finding && (
                          <p className="ml-10 text-xs">
                            <a href={`#finding-${finding.finding.id}`} className="-my-2 inline-flex min-h-11 items-center gap-1 text-red-800 underline underline-offset-4">
                              <ClipboardX className="size-3.5" aria-hidden /> Finding {finding.finding.reference} ·{" "}
                              {RISK_LABELS[finding.finding.risk]} risk
                            </a>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </section>

      <footer className="hidden border-t pt-2 text-xs text-muted-foreground print:block">
        {a.reference} · printed {formatDateTime(new Date())} by {user.name} · {APP_NAME}
      </footer>
    </article>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 print:col-span-3")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function FindingsSection({ findings }: { findings: RaisedFinding[] }) {
  return (
    <section className="space-y-2" aria-labelledby="findings-heading">
      <h2 id="findings-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Findings ({findings.length})
      </h2>
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No findings were raised.</p>
      ) : (
        <ul className="space-y-2">
          {findings.map(({ finding, actions }) => {
            const overdue = actions.some((x) => isOverdue(x));
            return (
              <li
                key={finding.id}
                id={`finding-${finding.id}`}
                className={cn("space-y-2 rounded-xl border border-l-4 bg-card p-3 break-inside-avoid", RISK_BORDER[finding.risk])}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-sm font-semibold text-teal">{finding.reference}</span>
                  <StatusBadge status={finding.status} />
                  <Badge className={RISK_BADGE[finding.risk]}>{RISK_LABELS[finding.risk]} risk</Badge>
                  {finding.critical && (
                    <Badge className="bg-destructive/10 text-destructive">
                      <ShieldAlert /> Critical
                    </Badge>
                  )}
                  {overdue && <Badge className="bg-destructive text-white">Overdue</Badge>}
                </div>
                <p className="text-sm">{finding.description}</p>
                <p className="text-xs text-muted-foreground">Raised {formatDate(finding.raisedAt)}</p>
                {finding.status === "CLOSED" && (
                  <p className="text-xs text-muted-foreground">
                    Closed {finding.closedAt ? formatDate(finding.closedAt) : ""}
                    {finding.closureComment ? `: ${finding.closureComment}` : ""}
                  </p>
                )}
                <ul className="space-y-1.5 border-t pt-2">
                  {actions.map((action) => (
                    <li key={action.id} className="space-y-0.5 text-xs">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono font-semibold">{action.reference}</span>
                        <StatusBadge status={action.status} />
                        {isOverdue(action) && <Badge className="bg-destructive/10 text-destructive">Overdue</Badge>}
                      </div>
                      {action.description !== finding.description && <p className="text-sm">{action.description}</p>}
                      <p className="flex flex-wrap gap-x-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3.5" aria-hidden /> {action.ownerName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" aria-hidden /> due {formatCalendarDate(action.targetDate)}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
