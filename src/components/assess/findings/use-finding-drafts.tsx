"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRepoQuery } from "@/lib/data/hooks";
import type { FormSection } from "@/lib/services/assessments";
import {
  addFindingDraft,
  listAssignableUsers,
  listFindingDrafts,
  removeFindingDraft,
  requiresFinding,
  updateFindingDraft,
  type FindingDraftValues,
} from "@/lib/services/findings";
import type { Answer, FindingDraft, ID, PublicUser } from "@/lib/types";
import { FindingSheet, type FindingSheetTarget } from "./finding-sheet";

/**
 * Findings prepared on a draft: loads them and the owner list, and renders the Raise finding sheet.
 * `answerOf` gives the current answer to a question (decides whether risk is locked to High).
 */
export function useFindingDrafts(
  user: PublicUser,
  assessmentId: ID,
  sections: FormSection[],
  answerOf: (questionId: ID) => Answer | null | undefined,
) {
  const queryClient = useQueryClient();
  const key = ["findingDrafts", assessmentId];
  const draftsQuery = useRepoQuery(key, () => listFindingDrafts(user, assessmentId));
  const ownersQuery = useRepoQuery(["users", "assignable"], () => listAssignableUsers(user), { staleTime: 5 * 60_000 });
  const [target, setTarget] = useState<FindingSheetTarget | null>(null);

  const drafts = useMemo(() => draftsQuery.data ?? [], [draftsQuery.data]);
  const owners = useMemo(() => ownersQuery.data ?? [], [ownersQuery.data]);
  const byQuestion = useMemo(
    () => new Map(drafts.flatMap((d) => (d.questionId ? [[d.questionId, d] as const] : []))),
    [drafts],
  );
  const general = useMemo(() => drafts.filter((d) => d.questionId === null), [drafts]);
  const questionsById = useMemo(
    () => new Map(sections.flatMap((s) => s.questions.map((q) => [q.id, q] as const))),
    [sections],
  );
  const ownerName = useCallback((id: ID) => owners.find((u) => u.id === id)?.name ?? "Unknown user", [owners]);

  /** Opens the sheet for a question (edits its finding if there is one) or for a new general finding (null). */
  const open = useCallback(
    (
      questionId: ID | null,
      // `answer`: pass the just-tapped answer, which local state may not show yet.
      options: { fromAnswer?: boolean; draft?: FindingDraft; answer?: Answer | null } = {},
    ) => {
      const question = questionId ? questionsById.get(questionId) : undefined;
      const answer = questionId ? options.answer ?? answerOf(questionId) : null;
      setTarget({
        questionId,
        questionText: question?.text ?? null,
        lockHigh: question ? requiresFinding(question, answer) : false,
        fromAnswer: options.fromAnswer ?? false,
        draft: options.draft ?? (questionId ? byQuestion.get(questionId) : undefined),
      });
    },
    [questionsById, answerOf, byQuestion],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  async function save(t: FindingSheetTarget, values: FindingDraftValues) {
    if (t.draft) await updateFindingDraft(user, t.draft.id, values);
    else await addFindingDraft(user, assessmentId, t.questionId, values);
    await refresh();
    toast.success(t.draft ? "Finding updated" : "Finding added. It will be raised when you submit.");
  }

  async function remove(draft: FindingDraft) {
    await removeFindingDraft(user, draft.id);
    await refresh();
    toast.success("Finding removed");
  }

  const sheet = (
    <FindingSheet
      target={target}
      onClose={() => setTarget(null)}
      owners={owners}
      currentUserId={user.id}
      onSave={save}
      onRemove={remove}
    />
  );

  // Without the prepared findings (or the owner list) the screen would wrongly show "no findings": say so instead.
  const failed = draftsQuery.isError || ownersQuery.isError;
  const retrying = draftsQuery.isFetching || ownersQuery.isFetching;
  const errorBanner = failed ? (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle />
      <AlertTitle>Couldn&apos;t load the findings for this assessment</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{(draftsQuery.error ?? ownersQuery.error)?.message}</p>
        <Button
          type="button"
          variant="outline"
          disabled={retrying}
          onClick={() => {
            if (draftsQuery.isError) void draftsQuery.refetch();
            if (ownersQuery.isError) void ownersQuery.refetch();
          }}
        >
          <RotateCw className={retrying ? "animate-spin" : undefined} /> {retrying ? "Retrying…" : "Try again"}
        </Button>
      </AlertDescription>
    </Alert>
  ) : null;

  return { drafts, byQuestion, general, ownerName, open, sheet, loading: draftsQuery.isPending, failed, errorBanner };
}
