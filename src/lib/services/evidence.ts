// Photo evidence rules for answers. Pure functions: no data access, safe to run in the browser or on a server.

import type { Answer, ID, Question } from "@/lib/types";

/** Most photos one answer can carry. */
export const MAX_PHOTOS_PER_QUESTION = 5;

/** Compressed photos are well under this; anything bigger is rejected as a safety net. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Answers that need a photo on an "evidence required" question (CLAUDE.md §7: No or Concern Identified only). */
export const EVIDENCE_ANSWERS: readonly Answer[] = ["NO", "CONCERN"];

/** True when this question, answered this way, must have at least one photo. */
export function evidenceNeeded(question: Pick<Question, "evidenceRequired">, answer: Answer | null | undefined): boolean {
  return question.evidenceRequired && answer != null && EVIDENCE_ANSWERS.includes(answer);
}

/** True when a photo is required but none is attached. */
export function isMissingEvidence(
  question: Pick<Question, "evidenceRequired">,
  answer: Answer | null | undefined,
  photoIds: readonly ID[] | undefined,
): boolean {
  return evidenceNeeded(question, answer) && (photoIds?.length ?? 0) === 0;
}

/** How many more photos fit on an answer that already has `attached` (plus `inFlight` still uploading). */
export function photoSlotsLeft(attached: number, inFlight = 0): number {
  return Math.max(0, MAX_PHOTOS_PER_QUESTION - attached - inFlight);
}
