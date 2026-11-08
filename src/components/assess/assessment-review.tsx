"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/admin/page-header";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, ClipboardX, Plus, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { useRepoQuery } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";
import {
  ANSWER_LONG_LABELS,
  KIND_LABELS,
  TAG_LABELS,
  answerLongLabelsFor,
  answerOptionsFor,
  loadAssessmentForm,
  missingEvidence,
  scoreAnswers,
  stopWorkItems,
  submitAssessment,
  unansweredQuestions,
  type AssessmentForm,
} from "@/lib/services/assessments";
import { findingsRequired, noAnswersWithoutFinding } from "@/lib/services/findings";
import type { Answer, ID, Question } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ANSWER_STYLES } from "./answer-style";
import { AnswerSummary } from "./answer-summary";
import { PendingFindingCard } from "./findings/finding-summaries";
import { useFindingDrafts } from "./findings/use-finding-drafts";
import { ScorePanel } from "./score-panel";
import { StartWorkDetailsLine } from "./start-work";

/** /assess/[id]/review: live score, answer summary, unanswered questions, and submit. */
export function AssessmentReview() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const query = useRepoQuery(["assessments", id, "review"], () => loadAssessmentForm(user, id), { refetchOnMount: "always" });

  return (
    <QueryState query={query} skeletonRows={4} notFound="assessment">
      {(form) => <Review form={form} />}
    </QueryState>
  );
}

function Review({ form }: { form: AssessmentForm }) {
  const user = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { assessment, sections, responses } = form;

  // Submitted (or not mine to edit): the review screen has nothing to do.
  useEffect(() => {
    if (!form.editable) router.replace(`/assessments/${assessment.id}`);
  }, [form.editable, assessment.id, router]);

  const answerOf = useCallback((questionId: ID) => responses[questionId]?.answer, [responses]);
  const findings = useFindingDrafts(user, assessment.id, sections, answerOf);

  const submit = useMutation({
    mutationFn: () => submitAssessment(user, assessment.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assessments"] });
      await queryClient.invalidateQueries({ queryKey: ["positiveInterventions"] });
      await queryClient.invalidateQueries({ queryKey: ["findings"] });
      await queryClient.invalidateQueries({ queryKey: ["findingDrafts"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["actions"] });
      router.replace(`/assess/${assessment.id}/submitted`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!form.editable) return null;

  const scores = scoreAnswers(sections, responses);
  const missing = unansweredQuestions(sections, responses);
  const needPhoto = missingEvidence(sections, responses);
  const required = findingsRequired(sections, responses, findings.drafts);
  const noFinding = noAnswersWithoutFinding(sections, responses, findings.drafts);
  const ready =
    missing.length === 0 && needPhoto.length === 0 && required.length === 0 && !findings.loading && !findings.failed;
  const questionNumber = new Map(sections.flatMap((s) => s.questions).map((q, index) => [q.id, index + 1]));
  const raiseButton = (q: Question, tone: "red" | "amber") => (
    <button
      type="button"
      onClick={() => findings.open(q.id)}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-4 text-sm font-medium",
        tone === "red" ? "bg-destructive text-white" : "border border-amber-400 bg-white text-amber-900",
      )}
    >
      <ClipboardX className="size-4" aria-hidden /> Raise
    </button>
  );
  const labels = answerLongLabelsFor(assessment.kind);
  const options = answerOptionsFor(assessment.kind);
  const noItems = assessment.kind === "START_WORK" ? stopWorkItems(sections, responses) : [];
  const answeredList = sections.flatMap((s) => s.questions).flatMap((q) => (responses[q.id] ? [responses[q.id]] : []));
  const countOf = (answer: Answer) => answeredList.filter((r) => r.answer === answer).length;
  const tagCount = (tag: "GOOD_PRACTICE" | "IMPROVEMENT") => answeredList.filter((r) => r.observationTag === tag).length;
  const title = assessment.kind === "MODULE" ? sections[0]?.module.name : KIND_LABELS[assessment.kind];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-28">
      <BackLink href={`/assess/${assessment.id}`} label="Back to questions" />

      <header>
        <p className="font-mono text-xs font-semibold text-teal">{assessment.reference}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Review {title}</h1>
        <p className="text-sm text-muted-foreground">{assessment.snapshot.vesselName}</p>
        {assessment.startWork && <StartWorkDetailsLine details={assessment.startWork} />}
      </header>

      {findings.errorBanner}

      <ScorePanel scores={scores} sections={sections} label="Live score" />

      <dl className={cn("grid gap-2 text-center", options.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
        {options.map((answer) => (
          <div key={answer} className="rounded-xl border bg-card p-2">
            <dt className="text-xs leading-tight text-balance text-muted-foreground">{labels[answer]}</dt>
            <dd className={cn("mx-auto mt-1 w-fit rounded-md px-2 text-lg font-semibold tabular-nums", ANSWER_STYLES[answer])}>
              {countOf(answer)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {tagCount("GOOD_PRACTICE")} {TAG_LABELS.GOOD_PRACTICE} · {tagCount("IMPROVEMENT")} {TAG_LABELS.IMPROVEMENT}
      </p>

      {noItems.length > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          You answered No to {noItems.length} item{noItems.length === 1 ? "" : "s"}. You can still submit, but work must
          not start until {noItems.length === 1 ? "it is" : "they are"} resolved.
        </p>
      )}

      {missing.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-4" aria-labelledby="missing-heading">
          <h2 id="missing-heading" className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            {missing.length} question{missing.length === 1 ? "" : "s"} still need{missing.length === 1 ? "s" : ""} an answer
          </h2>
          <ul className="space-y-1 text-sm">
            {missing.map((q) => (
              <li key={q.id}>
                <Link href={`/assess/${assessment.id}#q-${q.id}`} className="block py-2.5 text-destructive underline underline-offset-4">
                  {q.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {needPhoto.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4" aria-labelledby="photos-heading">
          <h2 id="photos-heading" className="flex items-center gap-2 font-medium text-amber-900">
            <Camera className="size-4" aria-hidden />
            {needPhoto.length} question{needPhoto.length === 1 ? "" : "s"} need{needPhoto.length === 1 ? "s" : ""} a photo
          </h2>
          <p className="text-xs text-amber-900">
            These need photo evidence because you answered {ANSWER_LONG_LABELS.NO} or {ANSWER_LONG_LABELS.CONCERN}.
          </p>
          <ul className="space-y-1 text-sm">
            {needPhoto.map((q) => (
              <li key={q.id}>
                <Link href={`/assess/${assessment.id}#q-${q.id}`} className="block py-2.5 text-amber-900 underline underline-offset-4">
                  {q.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {required.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-4" aria-labelledby="required-heading">
          <h2 id="required-heading" className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="size-4" aria-hidden />
            {required.length} critical control{required.length === 1 ? "" : "s"} answered No need
            {required.length === 1 ? "s" : ""} a finding
          </h2>
          <p className="text-xs text-destructive">A High-risk finding with an action owner is required before you can submit.</p>
          <ul className="space-y-2 text-sm">
            {required.map((q) => (
              <li key={q.id} className="flex items-start gap-2">
                <Link href={`/assess/${assessment.id}#q-${q.id}`} className="flex-1 py-2.5 text-destructive underline underline-offset-4">
                  Q{questionNumber.get(q.id)}. {q.text}
                </Link>
                {raiseButton(q, "red")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {noFinding.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4" aria-labelledby="no-finding-heading">
          <h2 id="no-finding-heading" className="flex items-center gap-2 font-medium text-amber-900">
            <ClipboardX className="size-4" aria-hidden />
            {noFinding.length} No answer{noFinding.length === 1 ? " has" : "s have"} no finding
          </h2>
          <p className="text-xs text-amber-900">You can still submit, but you&apos;ll be asked to confirm.</p>
          <ul className="space-y-2 text-sm">
            {noFinding.map((q) => (
              <li key={q.id} className="flex items-start gap-2">
                <Link href={`/assess/${assessment.id}#q-${q.id}`} className="flex-1 py-2.5 text-amber-900 underline underline-offset-4">
                  Q{questionNumber.get(q.id)}. {q.text}
                </Link>
                {raiseButton(q, "amber")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="pending-findings-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pending-findings-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Findings to be raised ({findings.drafts.length})
          </h2>
          <Button type="button" variant="outline" className="h-10" onClick={() => findings.open(null)}>
            <Plus /> Add general finding
          </Button>
        </div>
        {findings.drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings yet.</p>
        ) : (
          <div className="space-y-2">
            {findings.drafts.map((draft) => (
              <PendingFindingCard
                key={draft.id}
                label={draft.questionId ? `Finding · Q${questionNumber.get(draft.questionId) ?? "?"}` : "General finding"}
                draft={draft}
                ownerName={findings.ownerName(draft.ownerId)}
                onEdit={() => findings.open(draft.questionId, { draft })}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Each finding gets a reference number when you submit.</p>
      </section>

      {ready && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden /> Every question is answered. Check your answers, then submit.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your answers</h2>
        <AnswerSummary sections={sections} answers={responses} showModuleHeadings={sections.length > 1} labels={labels} />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <Button variant="outline" className="h-12 flex-1" onClick={() => router.push(`/assess/${assessment.id}`)}>
            Edit answers
          </Button>
          <Button
            className="h-12 flex-[1.4] text-base"
            disabled={!ready || submit.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Send /> Submit
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={noFinding.length > 0 ? "Submit without a finding for every No?" : "Submit this assessment?"}
        description={
          <>
            {noFinding.length > 0 && (
              <span className="mb-2 block font-medium text-amber-800">
                {noFinding.length} No answer{noFinding.length === 1 ? " has" : "s have"} no finding.
              </span>
            )}
            {assessment.reference} will be scored and locked
            {findings.drafts.length > 0 &&
              `, and ${findings.drafts.length} finding${findings.drafts.length === 1 ? "" : "s"} will be raised`}
            . You won&apos;t be able to change your answers afterwards.
          </>
        }
        confirmLabel={noFinding.length > 0 ? "Submit anyway" : "Submit"}
        onConfirm={() => submit.mutateAsync()}
      />
      {findings.sheet}
    </div>
  );
}
