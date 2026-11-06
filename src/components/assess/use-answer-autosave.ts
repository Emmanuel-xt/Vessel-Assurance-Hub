"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { compressPhoto } from "@/lib/photos/compress";
import { clearAnswer, deleteAnswerPhoto, saveAnswer, uploadAnswerPhoto } from "@/lib/services/assessments";
import { MAX_PHOTOS_PER_QUESTION, photoSlotsLeft } from "@/lib/services/evidence";
import type { Answer, ID, ObservationTag, PublicUser, Response } from "@/lib/types";

/** What the form shows for one question. `answer: null` = not answered (comment/tag/photos are held until it is). */
export interface LocalAnswer {
  answer: Answer | null;
  comment: string;
  tag: ObservationTag | null;
  photoIds: ID[];
}

export const EMPTY_ANSWER: LocalAnswer = { answer: null, comment: "", tag: null, photoIds: [] };

export interface AddPhotosResult {
  added: number;
  /** Files left out because the question already had the maximum number of photos. */
  skipped: number;
  errors: string[];
}

export type SaveState = "idle" | "saving" | "saved" | "error";

const COMMENT_DELAY_MS = 800;

const same = (a: LocalAnswer | undefined, b: LocalAnswer | undefined) =>
  (a?.answer ?? null) === (b?.answer ?? null) &&
  (a?.comment ?? "").trim() === (b?.comment ?? "").trim() &&
  (a?.tag ?? null) === (b?.tag ?? null) &&
  (a?.photoIds ?? []).join() === (b?.photoIds ?? []).join();

export function toLocalAnswers(responses: Record<ID, Response>): Record<ID, LocalAnswer> {
  return Object.fromEntries(
    Object.values(responses).map((r) => [r.questionId, { answer: r.answer, comment: r.comment, tag: r.observationTag, photoIds: r.photoIds }]),
  );
}

/**
 * Keeps answers in local state and saves each change through the service layer:
 * immediately for taps, after a short pause for typed comments. Saves for the same question run in order.
 */
export function useAnswerAutosave(user: PublicUser, assessmentId: ID, initial: Record<ID, LocalAnswer>) {
  const [answers, setAnswers] = useState(initial);
  const latest = useRef(initial);
  const persisted = useRef<Record<ID, LocalAnswer>>(initial);
  const timers = useRef(new Map<ID, ReturnType<typeof setTimeout>>());
  const chains = useRef(new Map<ID, Promise<void>>());
  const failed = useRef(new Set<ID>());
  const [pending, setPending] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  /** Photos being compressed/uploaded, per question (for spinners and the 5-photo limit). */
  const [uploading, setUploading] = useState<Record<ID, number>>({});
  const uploadingRef = useRef<Record<ID, number>>({});
  const uploads = useRef(new Set<Promise<unknown>>());

  const persist = useCallback(
    (questionId: ID) => {
      const run = async () => {
        const current = latest.current[questionId] ?? EMPTY_ANSWER;
        const previous = persisted.current[questionId];
        if (same(current, previous)) return;
        if (current.answer === null) {
          // Nothing to store without an answer; remove a previously saved one.
          if (previous?.answer) await clearAnswer(user, assessmentId, questionId);
        } else {
          await saveAnswer(user, {
            assessmentId,
            questionId,
            answer: current.answer,
            comment: current.comment,
            observationTag: current.tag,
            photoIds: current.photoIds,
          });
        }
        persisted.current = { ...persisted.current, [questionId]: current };
      };

      setPending((n) => n + 1);
      const chain = (chains.current.get(questionId) ?? Promise.resolve())
        .then(run)
        .then(
          () => {
            failed.current.delete(questionId);
            setHasSaved(true);
          },
          (error) => {
            failed.current.add(questionId);
            setLastError(errorMessage(error));
          },
        )
        .finally(() => {
          setPending((n) => n - 1);
          setFailedCount(failed.current.size);
        });
      chains.current.set(questionId, chain);
      return chain;
    },
    [user, assessmentId],
  );

  /** Changes one question. Typed comments wait for a pause; everything else saves straight away. */
  const update = useCallback(
    (questionId: ID, patch: Partial<LocalAnswer>, options: { debounce?: boolean } = {}) => {
      const next = { ...(latest.current[questionId] ?? EMPTY_ANSWER), ...patch };
      latest.current = { ...latest.current, [questionId]: next };
      setAnswers(latest.current);

      clearTimeout(timers.current.get(questionId));
      timers.current.delete(questionId);
      if (options.debounce) {
        timers.current.set(
          questionId,
          setTimeout(() => {
            timers.current.delete(questionId);
            void persist(questionId);
          }, COMMENT_DELAY_MS),
        );
      } else {
        void persist(questionId);
      }
    },
    [persist],
  );

  const changeUploading = useCallback((questionId: ID, delta: number) => {
    const next = { ...uploadingRef.current, [questionId]: (uploadingRef.current[questionId] ?? 0) + delta };
    if (next[questionId] <= 0) delete next[questionId];
    uploadingRef.current = next;
    setUploading(next);
    setPending((n) => n + delta);
  }, []);

  /**
   * Compresses and uploads photos one by one, attaching each to the question as soon as it is stored.
   * Files beyond the 5-photo limit are skipped.
   */
  const addPhotos = useCallback(
    (questionId: ID, files: File[]): Promise<AddPhotosResult> => {
      const attached = (latest.current[questionId] ?? EMPTY_ANSWER).photoIds.length;
      const accepted = files.slice(0, photoSlotsLeft(attached, uploadingRef.current[questionId] ?? 0));
      const result: AddPhotosResult = { added: 0, skipped: files.length - accepted.length, errors: [] };
      if (accepted.length === 0) return Promise.resolve(result);

      changeUploading(questionId, accepted.length);
      const work = (async () => {
        for (const file of accepted) {
          try {
            const compressed = await compressPhoto(file);
            const meta = await uploadAnswerPhoto(user, assessmentId, compressed.blob, {
              width: compressed.width,
              height: compressed.height,
            });
            const current = latest.current[questionId] ?? EMPTY_ANSWER;
            if (current.photoIds.length >= MAX_PHOTOS_PER_QUESTION) {
              await deleteAnswerPhoto(user, assessmentId, meta.id).catch(() => undefined);
              result.skipped += 1;
            } else {
              latest.current = { ...latest.current, [questionId]: { ...current, photoIds: [...current.photoIds, meta.id] } };
              setAnswers(latest.current);
              void persist(questionId);
              result.added += 1;
            }
          } catch (error) {
            result.errors.push(errorMessage(error));
          } finally {
            changeUploading(questionId, -1);
          }
        }
        return result;
      })();
      uploads.current.add(work);
      void work.finally(() => uploads.current.delete(work));
      return work;
    },
    [user, assessmentId, persist, changeUploading],
  );

  /**
   * Takes a photo off the question, saves the answer without it, then deletes the stored image.
   * The image is only deleted once no saved answer points at it.
   */
  const removePhoto = useCallback(
    async (questionId: ID, photoId: ID): Promise<void> => {
      const current = latest.current[questionId] ?? EMPTY_ANSWER;
      latest.current = { ...latest.current, [questionId]: { ...current, photoIds: current.photoIds.filter((id) => id !== photoId) } };
      setAnswers(latest.current);
      await persist(questionId);
      if (failed.current.has(questionId)) throw new Error("The photo was removed but the answer couldn't be saved. Try again.");
      await deleteAnswerPhoto(user, assessmentId, photoId);
    },
    [user, assessmentId, persist],
  );

  /** Saves anything waiting and resolves once every save has finished. Rejects if any failed. */
  const flush = useCallback(async () => {
    await Promise.all(uploads.current);
    for (const [questionId, timer] of timers.current) {
      clearTimeout(timer);
      void persist(questionId);
    }
    timers.current.clear();
    await Promise.all(chains.current.values());
    if (failed.current.size > 0) throw new Error(lastError ?? "Some answers could not be saved.");
  }, [persist, lastError]);

  const retry = useCallback(() => {
    for (const questionId of failed.current) void persist(questionId);
  }, [persist]);

  // Warn before closing the tab while something is unsaved; save typed comments when leaving the page in-app.
  useEffect(() => {
    const timerMap = timers.current;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (timerMap.size > 0 || failed.current.size > 0 || uploads.current.size > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const [questionId, timer] of timerMap) {
        clearTimeout(timer);
        void persist(questionId);
      }
      timerMap.clear();
    };
  }, [persist]);

  const saveState: SaveState = pending > 0 ? "saving" : failedCount > 0 ? "error" : hasSaved ? "saved" : "idle";

  return { answers, update, addPhotos, removePhoto, uploading, flush, retry, saveState, lastError };
}
