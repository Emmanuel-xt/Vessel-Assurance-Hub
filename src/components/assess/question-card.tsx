"use client";

import { memo, useState } from "react";
import { Camera, ClipboardX, MessageSquarePlus, Plus, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_LABELS, COMPLIANCE_LABELS, TAG_LABELS } from "@/lib/services/assessments";
import { isMissingEvidence, photoSlotsLeft } from "@/lib/services/evidence";
import { canRaiseFindingFor, requiresFinding } from "@/lib/services/findings";
import type { Answer, FindingDraft, ID, ObservationTag, Question } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ANSWER_STYLES } from "./answer-style";
import { PendingFindingCard } from "./findings/finding-summaries";
import { PhotoPickerButtons, PhotoThumbnails } from "./photos";
import type { AddPhotosResult, LocalAnswer } from "./use-answer-autosave";

interface QuestionCardProps {
  question: Question;
  number: number;
  /** Answers to offer: four for assessments, Yes / No / N/A for Start Work Checks. */
  options: readonly Answer[];
  /** Start Work Check: three big buttons with Compliant / Non-compliant captions. */
  startWork?: boolean;
  value: LocalAnswer;
  onChange: (questionId: string, patch: Partial<LocalAnswer>, options?: { debounce?: boolean }) => void;
  /** Photos for this question still being compressed / uploaded. */
  uploading: number;
  onAddPhotos: (questionId: ID, files: File[]) => Promise<AddPhotosResult>;
  onRemovePhoto: (questionId: ID, photoId: ID) => Promise<void>;
  /** Finding prepared for this question, if any. */
  finding?: FindingDraft;
  findingOwnerName?: string;
  onOpenFinding: (questionId: ID) => void;
}

const TAGS: { tag: ObservationTag; icon: React.ElementType }[] = [
  { tag: "GOOD_PRACTICE", icon: Sparkles },
  { tag: "IMPROVEMENT", icon: TrendingUp },
];

export const QuestionCard = memo(function QuestionCard({
  question,
  number,
  options,
  startWork = false,
  value,
  onChange,
  uploading,
  onAddPhotos,
  onRemovePhoto,
  finding,
  findingOwnerName,
  onOpenFinding,
}: QuestionCardProps) {
  const [showComment, setShowComment] = useState(value.comment !== "");
  const commentId = `comment-${question.id}`;
  const heldWithoutAnswer =
    value.answer === null && (value.comment.trim() !== "" || value.tag !== null || value.photoIds.length > 0);
  const photoNeeded = isMissingEvidence(question, value.answer, value.photoIds) && uploading === 0;
  const findingRequired = requiresFinding(question, value.answer);

  return (
    <article
      id={`q-${question.id}`}
      aria-labelledby={`q-${question.id}-text`}
      className={cn("scroll-mt-40 space-y-3 rounded-2xl border bg-card p-4", value.answer && "border-l-4 border-l-teal")}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Q{number}</span>
        {question.criticalControl && (
          <Badge className="bg-destructive/10 text-destructive">
            <ShieldAlert /> Critical
          </Badge>
        )}
        {question.evidenceRequired &&
          (photoNeeded ? (
            <Badge className="bg-amber-100 text-amber-900">
              <Camera /> Photo needed
            </Badge>
          ) : (
            <Badge className="bg-accent text-accent-foreground">
              <Camera /> Evidence required
            </Badge>
          ))}
      </div>

      <p id={`q-${question.id}-text`} className="text-base leading-snug font-medium">
        {question.text}
      </p>

      <div
        role="radiogroup"
        aria-labelledby={`q-${question.id}-text`}
        className={cn("grid gap-2", startWork ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}
      >
        {options.map((answer) => {
          const selected = value.answer === answer;
          const caption = startWork && answer !== "NA" ? COMPLIANCE_LABELS[answer] : null;
          return (
            <button
              key={answer}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(question.id, { answer: selected ? null : answer })}
              className={cn(
                "rounded-xl border-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
                startWork ? "flex h-16 flex-col items-center justify-center text-lg leading-tight" : "h-14 text-base",
                selected ? ANSWER_STYLES[answer] : "border-border bg-background hover:bg-muted",
              )}
            >
              {ANSWER_LABELS[answer]}
              {caption && (
                <span className={cn("text-[11px] font-normal", selected ? "text-white/90" : "text-muted-foreground")}>
                  {caption}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Phones: a tidy 2-column grid of 44px buttons. Wider screens: a row of pills. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {TAGS.map(({ tag, icon: Icon }) => {
          const on = value.tag === tag;
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(question.id, { tag: on ? null : tag })}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm transition-colors sm:justify-start sm:rounded-full",
                on
                  ? tag === "GOOD_PRACTICE"
                    ? "border-emerald-600 bg-emerald-50 font-medium text-emerald-800"
                    : "border-sky-600 bg-sky-50 font-medium text-sky-800"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {on ? <Icon className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              {tag === "IMPROVEMENT" ? (
                <>
                  <span className="sm:hidden">Improvement</span>
                  <span className="hidden sm:inline">{TAG_LABELS[tag]}</span>
                </>
              ) : (
                TAG_LABELS[tag]
              )}
            </button>
          );
        })}
        <PhotoPickerButtons
          slotsLeft={photoSlotsLeft(value.photoIds.length, uploading)}
          onAdd={(files) => onAddPhotos(question.id, files)}
        />
        {!showComment && (
          <button
            type="button"
            onClick={() => setShowComment(true)}
            className="col-span-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm text-muted-foreground hover:bg-muted sm:justify-start sm:rounded-full"
          >
            <MessageSquarePlus className="size-4" aria-hidden /> Comment
          </button>
        )}
      </div>

      <PhotoThumbnails
        photoIds={value.photoIds}
        uploading={uploading}
        onRemove={(photoId) => onRemovePhoto(question.id, photoId)}
      />

      {photoNeeded && (
        <p className="text-xs font-medium text-amber-800">
          Add at least one photo: this question needs evidence for a {ANSWER_LABELS[value.answer!]} answer.
        </p>
      )}

      {showComment && (
        <div className="space-y-1">
          <label htmlFor={commentId} className="text-xs font-medium text-muted-foreground">
            Comment (optional)
          </label>
          <Textarea
            id={commentId}
            rows={2}
            placeholder="What did you see?"
            value={value.comment}
            onChange={(e) => onChange(question.id, { comment: e.target.value }, { debounce: true })}
          />
        </div>
      )}

      {finding ? (
        <PendingFindingCard
          draft={finding}
          ownerName={findingOwnerName ?? ""}
          onEdit={() => onOpenFinding(question.id)}
          note={
            canRaiseFindingFor(value.answer)
              ? undefined
              : `The answer is no longer ${ANSWER_LABELS.NO} or ${ANSWER_LABELS.CONCERN}. Remove the finding if it no longer applies.`
          }
        />
      ) : (
        canRaiseFindingFor(value.answer) && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => onOpenFinding(question.id)}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                findingRequired
                  ? "border-destructive bg-destructive text-white hover:bg-destructive/90"
                  : "border-red-300 text-red-800 hover:bg-red-50",
              )}
            >
              <ClipboardX className="size-4" aria-hidden /> Raise finding
            </button>
            {findingRequired && (
              <p className="text-xs font-medium text-destructive">
                Critical control: a High-risk finding is required before you can submit.
              </p>
            )}
          </div>
        )
      )}

      {heldWithoutAnswer && (
        <p className="text-xs text-amber-700">Choose an answer to save your comment, tag and photos.</p>
      )}
    </article>
  );
});
