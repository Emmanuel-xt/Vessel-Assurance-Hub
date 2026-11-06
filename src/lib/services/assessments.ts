// Assessment rules: starting a draft, who may open it, and what the signed-in user owns.

import { z } from "zod";
import {
  actions,
  assessments,
  auditTypes,
  locations,
  findingDrafts,
  modules,
  photos,
  positiveInterventions,
  RepositoryError,
  type PhotoDimensions,
  responses,
  vessels,
} from "@/lib/data";
import { getAssessmentForUser, requireEditableDraft } from "@/lib/services/assessment-access";
import { parseOrThrow, ValidationError } from "@/lib/services/errors";
import { MAX_PHOTOS_PER_QUESTION, MAX_PHOTO_BYTES, isMissingEvidence } from "@/lib/services/evidence";
import { checkFindingsBeforeSubmit, raiseDraftFindings } from "@/lib/services/findings";
import {
  PermissionError,
  allowedAuditTypesFor,
  canEditAssessment,
  requireUser,
  type Principal,
} from "@/lib/services/permissions";
import { getQuestionsFor } from "@/lib/services/questions";
import { calculateAssessmentScores, type AssessmentScores } from "@/lib/services/scoring";
import type {
  Action,
  Answer,
  Assessment,
  AssessmentKind,
  ID,
  Module,
  ObservationTag,
  PhotoMeta,
  Question,
  Response,
} from "@/lib/types";

/** Button labels (design document wording). Stored values stay YES / CONCERN / NO / NA. */
export const ANSWER_LABELS: Record<Answer, string> = {
  YES: "Yes",
  CONCERN: "Concern",
  NO: "No",
  NA: "N/A",
};

/** Long form for summaries, e.g. "Concern Identified". */
export const ANSWER_LONG_LABELS: Record<Answer, string> = {
  YES: "Yes",
  CONCERN: "Concern Identified",
  NO: "No",
  NA: "Not applicable",
};

/** Every answer, in button order. */
export const ALL_ANSWERS: readonly Answer[] = ["YES", "CONCERN", "NO", "NA"];

/** Start Work Checks are quick go / no-go checks: Yes / No / N/A, no "Concern". */
export const START_WORK_ANSWERS: readonly Answer[] = ["YES", "NO", "NA"];

/** Summary wording for Start Work Checks: Yes = Compliant, No = Non-Compliant. */
export const COMPLIANCE_LABELS: Record<Answer, string> = {
  YES: "Compliant",
  CONCERN: "Concern Identified",
  NO: "Non-Compliant",
  NA: "Not applicable",
};

/** The answers offered (and accepted) for a kind of assessment. */
export function answerOptionsFor(kind: AssessmentKind): readonly Answer[] {
  return kind === "START_WORK" ? START_WORK_ANSWERS : ALL_ANSWERS;
}

/** Summary labels for a kind of assessment (Compliant / Non-Compliant for Start Work Checks). */
export function answerLongLabelsFor(kind: AssessmentKind): Record<Answer, string> {
  return kind === "START_WORK" ? COMPLIANCE_LABELS : ANSWER_LONG_LABELS;
}

export const TAG_LABELS: Record<ObservationTag, string> = {
  GOOD_PRACTICE: "Good Practice",
  IMPROVEMENT: "Improvement Opportunity",
};

export const KIND_LABELS: Record<AssessmentKind, string> = {
  MODULE: "Module assessment",
  FULL_VESSEL: "Full Vessel Assurance",
  START_WORK: "Start Work Check",
};

/** Module category each kind draws from. */
const CATEGORY_FOR: Record<AssessmentKind, Module["category"]> = {
  MODULE: "ASSURANCE",
  FULL_VESSEL: "ASSURANCE",
  START_WORK: "START_WORK",
};

// ---------- Starting a draft ----------

export const TASK_DESCRIPTION_LENGTH = { min: 3, max: 200 } as const;
export const TEAM_SIZE_RANGE = { min: 1, max: 99 } as const;

export const assessmentSetupSchema = z
  .object({
    kind: z.enum(["MODULE", "FULL_VESSEL", "START_WORK"]),
    /** The module (MODULE) or the task (START_WORK). Not used for FULL_VESSEL. */
    moduleId: z.string(),
    vesselId: z.string().min(1, { error: "Choose a vessel" }),
    locationId: z.string().min(1, { error: "Choose a location" }),
    auditTypeId: z.string().min(1, { error: "Choose an audit type" }),
    /** Start Work Checks only: the job about to start. */
    taskDescription: z.string().optional(),
    /** Start Work Checks only: people in the team. */
    teamSize: z.number().optional(),
  })
  .refine((v) => v.kind === "FULL_VESSEL" || v.moduleId !== "", {
    error: "Choose what you are checking",
    path: ["moduleId"],
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "START_WORK") return;
    const task = (v.taskDescription ?? "").trim();
    if (task.length < TASK_DESCRIPTION_LENGTH.min) {
      ctx.addIssue({ code: "custom", path: ["taskDescription"], message: "Describe the job you are about to start" });
    } else if (task.length > TASK_DESCRIPTION_LENGTH.max) {
      ctx.addIssue({
        code: "custom",
        path: ["taskDescription"],
        message: `Keep it under ${TASK_DESCRIPTION_LENGTH.max} characters`,
      });
    }
    const size = v.teamSize;
    if (size === undefined || !Number.isInteger(size) || size < TEAM_SIZE_RANGE.min || size > TEAM_SIZE_RANGE.max) {
      ctx.addIssue({
        code: "custom",
        path: ["teamSize"],
        message: `Enter the number of people (${TEAM_SIZE_RANGE.min}–${TEAM_SIZE_RANGE.max})`,
      });
    }
  });

export type AssessmentSetupValues = z.input<typeof assessmentSetupSchema>;

/** Active modules of the right category for a kind of assessment, in hub order. */
export async function modulesFor(kind: AssessmentKind): Promise<Module[]> {
  return modules.list({ activeOnly: true, category: CATEGORY_FOR[kind] });
}

/**
 * Validates the setup form and creates a DRAFT assessment (with its reference number and snapshot) for the actor.
 * Every rule is enforced here, not just in the UI.
 */
export async function startAssessment(actor: Principal, input: AssessmentSetupValues): Promise<Assessment> {
  const user = requireUser(actor);
  const values = parseOrThrow(assessmentSetupSchema, input);

  const [vessel, location, auditType, eligibleModules] = await Promise.all([
    vessels.get(values.vesselId),
    locations.get(values.locationId),
    auditTypes.get(values.auditTypeId),
    modulesFor(values.kind),
  ]);

  if (!vessel || vessel.status !== "ACTIVE") {
    throw new ValidationError("This vessel is not available.", { vesselId: "Choose an active vessel" });
  }
  if (!location || !location.active) {
    throw new ValidationError("This location is not available.", { locationId: "Choose an active location" });
  }
  if (!auditType) {
    throw new ValidationError("Choose an audit type.", { auditTypeId: "Choose an audit type" });
  }
  if (allowedAuditTypesFor(user.role, values.kind, [auditType]).length === 0) {
    throw new PermissionError("FORBIDDEN", `You can't use the ${auditType.name} audit type here.`);
  }

  let moduleIds: ID[];
  if (values.kind === "FULL_VESSEL") {
    if (eligibleModules.length === 0) throw new ValidationError("There are no active assurance modules.");
    moduleIds = eligibleModules.map((m) => m.id);
  } else {
    if (!eligibleModules.some((m) => m.id === values.moduleId)) {
      throw new ValidationError("This module is not available.", { moduleId: "Choose an available option" });
    }
    moduleIds = [values.moduleId];
  }

  return assessments.create({
    kind: values.kind,
    moduleIds,
    userId: user.id,
    vesselId: vessel.id,
    locationId: location.id,
    auditTypeId: auditType.id,
    startWork:
      values.kind === "START_WORK"
        ? { taskDescription: (values.taskDescription ?? "").trim(), teamSize: values.teamSize! }
        : null,
  });
}

/** How many questions each module will ask for this vessel type and audit type. */
export async function countApplicableQuestions(context: {
  moduleIds: ID[];
  vesselTypeId: ID;
  auditTypeId: ID;
}): Promise<Record<ID, number>> {
  const counts = await Promise.all(
    context.moduleIds.map(async (moduleId) => {
      const list = await getQuestionsFor({ moduleId, vesselTypeId: context.vesselTypeId, auditTypeId: context.auditTypeId });
      return [moduleId, list.length] as const;
    }),
  );
  return Object.fromEntries(counts);
}

// ---------- Reading ----------

export { getAssessmentForUser };

/** The actor's own assessments: drafts first (most recently edited), then submitted (newest first). */
export async function listMyAssessments(actor: Principal): Promise<Assessment[]> {
  const user = requireUser(actor);
  const mine = await assessments.list({ userId: user.id });
  const drafts = mine.filter((a) => a.status === "DRAFT");
  const submitted = mine
    .filter((a) => a.status === "SUBMITTED")
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  return [...drafts, ...submitted];
}

/** Actions assigned to the actor that are not closed (open or in progress). */
export async function listMyOpenActions(actor: Principal): Promise<Action[]> {
  const user = requireUser(actor);
  const mine = await actions.list({ ownerId: user.id });
  return mine.filter((a) => a.status !== "CLOSED");
}

// ---------- The question form ----------

export interface FormSection {
  module: Module;
  questions: Question[];
}

export interface AssessmentForm {
  assessment: Assessment;
  /** One section per module, in the assessment's module order. */
  sections: FormSection[];
  /** Saved answers, by question id. */
  responses: Record<ID, Response>;
  /** True when the actor may answer (owner of a draft). Otherwise the form is read-only. */
  editable: boolean;
}

/** Questions that apply to this assessment right now, per module. */
async function applicableSections(assessment: Assessment): Promise<FormSection[]> {
  const [vessel, moduleList] = await Promise.all([vessels.get(assessment.vesselId), modules.list()]);
  if (!vessel) throw new RepositoryError("NOT_FOUND", "The vessel for this assessment no longer exists.");
  const sections = await Promise.all(
    assessment.moduleIds.map(async (moduleId) => ({
      module: moduleList.find((m) => m.id === moduleId),
      questions: await getQuestionsFor({ moduleId, vesselTypeId: vessel.vesselTypeId, auditTypeId: assessment.auditTypeId }),
    })),
  );
  return sections.filter((s): s is FormSection => s.module !== undefined);
}

export async function loadAssessmentForm(actor: Principal, id: ID): Promise<AssessmentForm> {
  const assessment = await getAssessmentForUser(actor, id);
  const [sections, saved] = await Promise.all([applicableSections(assessment), responses.listByAssessment(id)]);
  return {
    assessment,
    sections,
    responses: Object.fromEntries(saved.map((r) => [r.questionId, r])),
    editable: canEditAssessment(actor, assessment),
  };
}

export interface AnswerInput {
  assessmentId: ID;
  questionId: ID;
  answer: Answer;
  comment: string;
  observationTag: ObservationTag | null;
  /** Photos in display order. Leave out to keep the photos already attached. */
  photoIds?: ID[];
}

/** Checks a new photo list: no duplicates, at most MAX_PHOTOS_PER_QUESTION, and newly added photos must exist. */
async function validatePhotoIds(photoIds: ID[], alreadyAttached: ID[]): Promise<void> {
  if (new Set(photoIds).size !== photoIds.length) throw new ValidationError("The same photo is attached twice.");
  if (photoIds.length > MAX_PHOTOS_PER_QUESTION) {
    throw new ValidationError(`An answer can have at most ${MAX_PHOTOS_PER_QUESTION} photos.`);
  }
  const added = photoIds.filter((id) => !alreadyAttached.includes(id));
  const metas = await Promise.all(added.map((id) => photos.getMeta(id)));
  if (metas.some((meta) => meta === null)) {
    throw new ValidationError("A photo could not be found. Remove it and add it again.");
  }
}

/** Saves (creates or replaces) one answer in the actor's draft. */
export async function saveAnswer(actor: Principal, input: AnswerInput): Promise<Response> {
  const assessment = await requireEditableDraft(actor, input.assessmentId);
  if (!answerOptionsFor(assessment.kind).includes(input.answer)) {
    throw new ValidationError("A Start Work Check is answered Yes, No or N/A.");
  }
  const existing = (await responses.listByAssessment(input.assessmentId)).find((r) => r.questionId === input.questionId);
  const attached = existing?.photoIds ?? [];
  const photoIds = input.photoIds ?? attached;
  if (input.photoIds) await validatePhotoIds(photoIds, attached);
  return responses.upsert({
    assessmentId: input.assessmentId,
    questionId: input.questionId,
    answer: input.answer,
    comment: input.comment.trim(),
    observationTag: input.observationTag,
    photoIds: [...photoIds],
  });
}

/**
 * Stores an already-compressed photo for the actor's draft. It is attached to an answer by the next saveAnswer
 * with its id in `photoIds` (so a photo can be taken before the answer is chosen).
 */
export async function uploadAnswerPhoto(
  actor: Principal,
  assessmentId: ID,
  blob: Blob,
  dimensions?: PhotoDimensions,
): Promise<PhotoMeta> {
  await requireEditableDraft(actor, assessmentId);
  if (blob.type && !blob.type.startsWith("image/")) throw new ValidationError("Only photos can be attached.");
  if (blob.size === 0) throw new ValidationError("This photo is empty.");
  if (blob.size > MAX_PHOTO_BYTES) throw new ValidationError("This photo is too large, even after compression.");
  return photos.upload(blob, dimensions);
}

/**
 * Deletes a photo from storage. It must already be removed from every saved answer (save the answer without it
 * first), so a saved answer never points at a missing photo.
 */
export async function deleteAnswerPhoto(actor: Principal, assessmentId: ID, photoId: ID): Promise<void> {
  await requireEditableDraft(actor, assessmentId);
  const all = await responses.list();
  if (all.some((r) => r.photoIds.includes(photoId))) {
    throw new RepositoryError("CONFLICT", "This photo is still attached to an answer.");
  }
  await photos.delete(photoId);
}

/** Removes the answer to one question (the user tapped the selected answer again). */
export async function clearAnswer(actor: Principal, assessmentId: ID, questionId: ID): Promise<void> {
  await requireEditableDraft(actor, assessmentId);
  const existing = (await responses.listByAssessment(assessmentId)).find((r) => r.questionId === questionId);
  if (existing) await responses.remove(existing.id);
}

type ScorableResponse = Pick<Response, "answer" | "questionSnapshot">;

/**
 * Scores the answers to the questions that currently apply (answers to questions that no longer apply are ignored).
 * Used for the live score on the review screen and, identically, at submit.
 */
export function scoreAnswers(sections: FormSection[], answers: Record<ID, ScorableResponse>): AssessmentScores {
  const scorable = sections.flatMap((section) =>
    section.questions.flatMap((question) => {
      const response = answers[question.id];
      return response
        ? [{ moduleId: section.module.id, answer: response.answer, weight: response.questionSnapshot.weight }]
        : [];
    }),
  );
  return calculateAssessmentScores(
    scorable,
    sections.map((s) => s.module.id),
  );
}

/** Applicable questions that have no answer yet. */
export function unansweredQuestions(sections: FormSection[], answers: Record<ID, unknown>): Question[] {
  return sections.flatMap((s) => s.questions.filter((q) => !answers[q.id]));
}

/** Start Work Checks: applicable questions answered No (Non-Compliant). Work must not start until they are resolved. */
export function stopWorkItems(sections: FormSection[], answers: Record<ID, Pick<Response, "answer"> | undefined>): Question[] {
  return sections.flatMap((s) => s.questions.filter((q) => answers[q.id]?.answer === "NO"));
}

/** Answered, applicable questions that need a photo (evidence required + No / Concern) but have none. */
export function missingEvidence(
  sections: FormSection[],
  answers: Record<ID, Pick<Response, "answer" | "photoIds"> | undefined>,
): Question[] {
  return sections.flatMap((s) =>
    s.questions.filter((q) => {
      const answer = answers[q.id];
      return answer !== undefined && isMissingEvidence(q, answer.answer, answer.photoIds);
    }),
  );
}

/**
 * Submits the actor's draft. Every applicable question must be answered, and every "evidence required" question
 * answered No or Concern Identified must have a photo, and every critical control answered No must have a High-risk
 * finding. Scores are calculated here (not in the data layer). After submit, each "Good Practice" answer becomes a
 * positive intervention and each prepared finding becomes a finding with action A1.
 */
export async function submitAssessment(actor: Principal, id: ID): Promise<Assessment> {
  const assessment = await requireEditableDraft(actor, id);
  const [sections, saved] = await Promise.all([applicableSections(assessment), responses.listByAssessment(id)]);
  const answers = Object.fromEntries(saved.map((r) => [r.questionId, r]));

  const missing = unansweredQuestions(sections, answers);
  if (missing.length > 0) {
    const noun = missing.length === 1 ? "question still needs" : "questions still need";
    throw new ValidationError(`${missing.length} ${noun} an answer before you can submit.`);
  }
  const noPhoto = missingEvidence(sections, answers);
  if (noPhoto.length > 0) {
    const noun = noPhoto.length === 1 ? "question still needs" : "questions still need";
    throw new ValidationError(`${noPhoto.length} ${noun} a photo before you can submit.`);
  }
  const drafts = await findingDrafts.listByAssessment(id);
  await checkFindingsBeforeSubmit(sections, answers, drafts);

  const scores = scoreAnswers(sections, answers);
  const submitted = await assessments.submit(id, { overallScore: scores.overall, moduleScores: scores.byModule });

  const applicable = new Set(sections.flatMap((s) => s.questions.map((q) => q.id)));
  for (const response of saved) {
    if (response.observationTag === "GOOD_PRACTICE" && applicable.has(response.questionId)) {
      await positiveInterventions.create({
        assessmentId: id,
        responseId: response.id,
        description: response.comment || response.questionSnapshot.text,
        recordedById: submitted.userId,
      });
    }
  }
  await raiseDraftFindings(requireUser(actor), submitted, drafts, saved);
  return submitted;
}
