"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ClipboardCheck, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { KIND_LABELS, answerOptionsFor, type AssessmentForm as FormData } from "@/lib/services/assessments";
import { opensFindingSheet } from "@/lib/services/findings";
import type { Answer, ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PendingFindingCard } from "./findings/finding-summaries";
import { useFindingDrafts } from "./findings/use-finding-drafts";
import { ModuleSection } from "./module-section";
import { teamLabel } from "./start-work";
import { QuestionCard } from "./question-card";
import { EMPTY_ANSWER, toLocalAnswers, useAnswerAutosave, type LocalAnswer, type SaveState } from "./use-answer-autosave";

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…
      </span>
    );
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="-my-3 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-destructive" role="status">
        <AlertTriangle className="size-3.5" aria-hidden /> Couldn&apos;t save. Retry
      </button>
    );
  if (state === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700" role="status">
        <Check className="size-3.5" aria-hidden /> Saved
      </span>
    );
  return <span className="text-xs text-muted-foreground">Answers save automatically</span>;
}

export function AssessmentForm({ form }: { form: FormData }) {
  const user = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { assessment, sections } = form;
  const { answers, update, addPhotos, removePhoto, uploading, flush, retry, saveState } = useAnswerAutosave(
    user,
    assessment.id,
    useMemo(() => toLocalAnswers(form.responses), [form.responses]),
  );
  const [leaving, setLeaving] = useState<"draft" | "review" | null>(null);

  // Findings: a "No" opens the Raise finding sheet (unless the question already has one).
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const answerOf = useCallback((questionId: ID) => answersRef.current[questionId]?.answer, []);
  const findings = useFindingDrafts(user, assessment.id, sections, answerOf);
  const { byQuestion, open: openFinding, ownerName } = findings;

  const onAnswerChange = useCallback(
    (questionId: ID, patch: Partial<LocalAnswer>, options?: { debounce?: boolean }) => {
      update(questionId, patch, options);
      if (opensFindingSheet(patch.answer) && !byQuestion.has(questionId)) {
        openFinding(questionId, { fromAnswer: true, answer: patch.answer as Answer });
      }
    },
    [update, byQuestion, openFinding],
  );
  const onOpenFinding = useCallback((questionId: ID) => openFinding(questionId), [openFinding]);

  const total = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const answeredIn = (questionIds: string[]) => questionIds.filter((id) => answers[id]?.answer).length;
  const answered = answeredIn(sections.flatMap((s) => s.questions.map((q) => q.id)));
  const grouped = assessment.kind === "FULL_VESSEL";
  const questionNumbers = useMemo(
    () => new Map(sections.flatMap((s) => s.questions).map((q, index) => [q.id, index + 1])),
    [sections],
  );

  // Full Vessel: open the first unfinished section (or the one a #q-… link points at).
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const firstOpen = sections.find((s) => answeredIn(s.questions.map((q) => q.id)) < s.questions.length);
    return new Set(firstOpen ? [firstOpen.module.id] : []);
  });

  useEffect(() => {
    const questionId = window.location.hash.replace(/^#q-/, "");
    if (!questionId || questionId === window.location.hash) return;
    const section = sections.find((s) => s.questions.some((q) => q.id === questionId));
    if (section) setOpenSections((open) => new Set(open).add(section.module.id));
    requestAnimationFrame(() => document.getElementById(`q-${questionId}`)?.scrollIntoView({ block: "start" }));
  }, [sections]);

  const toggleSection = (moduleId: string) =>
    setOpenSections((open) => {
      const next = new Set(open);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });

  async function leave(to: "draft" | "review") {
    setLeaving(to);
    try {
      await flush();
      await queryClient.invalidateQueries({ queryKey: ["assessments"] });
      if (to === "draft") {
        toast.success(`Draft ${assessment.reference} saved`);
        router.push("/assessments");
      } else {
        router.push(`/assess/${assessment.id}/review`);
      }
    } catch {
      toast.error("Some answers could not be saved. Check your connection and try again.");
      setLeaving(null);
    }
  }

  const cards = (questions: FormData["sections"][number]["questions"]) =>
    questions.map((question) => (
      <QuestionCard
        key={question.id}
        question={question}
        number={questionNumbers.get(question.id) ?? 0}
        options={answerOptionsFor(assessment.kind)}
        startWork={assessment.kind === "START_WORK"}
        value={answers[question.id] ?? EMPTY_ANSWER}
        onChange={onAnswerChange}
        uploading={uploading[question.id] ?? 0}
        onAddPhotos={addPhotos}
        onRemovePhoto={removePhoto}
        finding={byQuestion.get(question.id)}
        findingOwnerName={byQuestion.has(question.id) ? ownerName(byQuestion.get(question.id)!.ownerId) : undefined}
        onOpenFinding={onOpenFinding}
      />
    ));

  const title = assessment.kind === "MODULE" ? sections[0]?.module.name : KIND_LABELS[assessment.kind];
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <header className="sticky top-14 z-30 -mx-4 space-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-teal">{assessment.reference}</p>
            <h1 className="truncate text-lg font-semibold">
              {title}
              {assessment.kind === "START_WORK" && sections[0] && (
                <span className="font-normal text-muted-foreground"> · {sections[0].module.name}</span>
              )}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {assessment.snapshot.vesselName}
              {assessment.startWork && ` · ${assessment.startWork.taskDescription} · ${teamLabel(assessment.startWork.teamSize)}`}
            </p>
          </div>
          <SaveIndicator state={saveState} onRetry={retry} />
        </div>
        <div className="space-y-1">
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
          >
            <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {answered} of {total} answered
          </p>
        </div>
      </header>

      {findings.errorBanner}

      <div className="mt-4 space-y-3">
        {grouped
          ? sections.map((section) => (
              <ModuleSection
                key={section.module.id}
                module={section.module}
                answered={answeredIn(section.questions.map((q) => q.id))}
                total={section.questions.length}
                open={openSections.has(section.module.id)}
                onToggle={() => toggleSection(section.module.id)}
              >
                {cards(section.questions)}
              </ModuleSection>
            ))
          : sections.map((section) => cards(section.questions))}
        {total === 0 && (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No questions apply to this vessel and audit type.
          </p>
        )}

        <section className="space-y-3 rounded-2xl border border-dashed p-4" aria-labelledby="general-findings-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="general-findings-heading" className="font-medium">
                General findings
              </h2>
              <p className="text-xs text-muted-foreground">Anything you noticed that isn&apos;t covered by a question.</p>
            </div>
            <Button type="button" variant="outline" className="h-10" onClick={() => openFinding(null)}>
              <Plus /> Add general finding
            </Button>
          </div>
          {findings.general.map((draft) => (
            <PendingFindingCard
              key={draft.id}
              label="General finding"
              draft={draft}
              ownerName={ownerName(draft.ownerId)}
              onEdit={() => openFinding(null, { draft })}
            />
          ))}
        </section>
      </div>
      {findings.sheet}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <Button variant="outline" className="h-12 flex-1" disabled={leaving !== null} onClick={() => leave("draft")}>
            {leaving === "draft" ? <Loader2 className="animate-spin" /> : <Save />} Save draft
          </Button>
          <Button
            className={cn("h-12 flex-[1.4] text-base", answered === total && total > 0 && "bg-teal hover:bg-teal/90")}
            disabled={leaving !== null}
            onClick={() => leave("review")}
          >
            {leaving === "review" ? <Loader2 className="animate-spin" /> : <ClipboardCheck />} Review &amp; submit
          </Button>
        </div>
      </div>
    </div>
  );
}
