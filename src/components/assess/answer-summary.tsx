import { MessageSquare, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ANSWER_LONG_LABELS, TAG_LABELS, type FormSection } from "@/lib/services/assessments";
import type { Answer, ID, Response } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ANSWER_STYLES } from "./answer-style";
import { PhotoThumbnails } from "./photos";

type SummaryAnswer = Pick<Response, "answer" | "comment" | "observationTag" | "photoIds">;

/** Read-only list of questions with their answers, comments, tags and photos (tap to enlarge). */
export function AnswerSummary({
  sections,
  answers,
  showModuleHeadings,
  labels = ANSWER_LONG_LABELS,
}: {
  sections: FormSection[];
  answers: Record<ID, SummaryAnswer | undefined>;
  showModuleHeadings: boolean;
  /** Answer wording; Start Work Checks use Compliant / Non-Compliant. */
  labels?: Record<Answer, string>;
}) {
  let number = 0;
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.module.id} className="space-y-2">
          {showModuleHeadings && <h3 className="text-sm font-semibold">{section.module.name}</h3>}
          <ol className="divide-y rounded-2xl border bg-card">
            {section.questions.map((question) => {
              number += 1;
              const answer = answers[question.id];
              return (
                <li key={question.id} id={`q-${question.id}`} className="space-y-1.5 p-3">
                  <div className="flex items-start gap-3">
                    <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">Q{number}</span>
                    <p className="flex-1 text-sm">{question.text}</p>
                    {answer ? (
                      <Badge className={cn("shrink-0", ANSWER_STYLES[answer.answer])}>{labels[answer.answer]}</Badge>
                    ) : (
                      <Badge className="shrink-0 bg-destructive/10 text-destructive">Unanswered</Badge>
                    )}
                  </div>
                  {answer?.comment && (
                    <p className="ml-10 flex gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {answer.comment}
                    </p>
                  )}
                  {answer?.observationTag && (
                    <p className="ml-10">
                      <Badge
                        className={
                          answer.observationTag === "GOOD_PRACTICE" ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800"
                        }
                      >
                        {answer.observationTag === "GOOD_PRACTICE" ? <Sparkles /> : <TrendingUp />}
                        {TAG_LABELS[answer.observationTag]}
                      </Badge>
                    </p>
                  )}
                  {answer && answer.photoIds.length > 0 && (
                    <div className="ml-10">
                      <PhotoThumbnails photoIds={answer.photoIds} size="sm" />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
