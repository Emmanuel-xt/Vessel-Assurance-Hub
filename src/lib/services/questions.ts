// Question bank rules: what the assessment form asks, and how admins grow the bank.

import { z } from "zod";
import { auditTypes, modules, questions, RepositoryError, riskCategories, vesselTypes } from "@/lib/data";
import { requireAdmin, orNotFound } from "@/lib/services/admin/shared";
import { parseOrThrow, ValidationError } from "@/lib/services/errors";
import { moveInOrder, nextDisplayOrder, type MoveDirection } from "@/lib/services/ordering";
import type { Principal } from "@/lib/services/permissions";
import type { ID, Question } from "@/lib/types";

// ---------- Assessment form ----------

export interface QuestionContext {
  moduleId: ID;
  /** The vessel's type id (vessel.vesselTypeId). */
  vesselTypeId: ID;
  auditTypeId: ID;
}

/** Active questions for a module that apply to this vessel type and audit type, in display order. */
export async function getQuestionsFor(context: QuestionContext): Promise<Question[]> {
  const list = await questions.listFor(context);
  return list.sort((a, b) => a.displayOrder - b.displayOrder);
}

// ---------- Admin: add / edit ----------

export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 5;

export const questionFormSchema = z.object({
  moduleId: z.string().min(1, { error: "Choose a module" }),
  text: z
    .string()
    .trim()
    .min(5, { error: "Enter the question (at least 5 characters)" })
    .max(300, { error: "Keep the question under 300 characters" }),
  riskCategoryId: z.string().min(1, { error: "Choose a risk category" }),
  weight: z
    .number({ error: `Weight must be a whole number from ${WEIGHT_MIN} to ${WEIGHT_MAX}` })
    .int({ error: `Weight must be a whole number from ${WEIGHT_MIN} to ${WEIGHT_MAX}` })
    .min(WEIGHT_MIN, { error: `Weight must be at least ${WEIGHT_MIN}` })
    .max(WEIGHT_MAX, { error: `Weight must be at most ${WEIGHT_MAX}` }),
  criticalControl: z.boolean(),
  evidenceRequired: z.boolean(),
  vesselTypeIds: z.array(z.string()),
  auditTypeIds: z.array(z.string()),
  active: z.boolean(),
});

export type QuestionFormValues = z.input<typeof questionFormSchema>;

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Creates (id = null, added at the end of its module) or updates a question. */
export async function saveQuestion(actor: Principal, id: ID | null, input: QuestionFormValues): Promise<Question> {
  requireAdmin(actor);
  const values = parseOrThrow(questionFormSchema, input);

  const [moduleRecord, risk, types, audits, inModule] = await Promise.all([
    modules.get(values.moduleId),
    riskCategories.get(values.riskCategoryId),
    vesselTypes.list(),
    auditTypes.list(),
    questions.list({ moduleId: values.moduleId }),
  ]);
  if (!moduleRecord) throw new ValidationError("Choose a module.", { moduleId: "Choose a module" });
  if (!risk) throw new ValidationError("Choose a risk category.", { riskCategoryId: "Choose a risk category" });
  if (values.vesselTypeIds.some((typeId) => !types.some((t) => t.id === typeId))) {
    throw new ValidationError("Unknown vessel type.", { vesselTypeIds: "Choose from the listed vessel types" });
  }
  if (values.auditTypeIds.some((typeId) => !audits.some((t) => t.id === typeId))) {
    throw new ValidationError("Unknown audit type.", { auditTypeIds: "Choose from the listed audit types" });
  }
  if (inModule.some((q) => q.id !== id && sameText(q.text, values.text))) {
    throw new ValidationError("This module already has that question.", {
      text: "This module already has a question with this wording.",
    });
  }

  if (id === null) {
    return questions.create({ ...values, displayOrder: nextDisplayOrder(inModule) });
  }
  const existing = orNotFound(await questions.get(id), "Question", id);
  // Moving to another module puts the question at the end of that module.
  const displayOrder = existing.moduleId === values.moduleId ? existing.displayOrder : nextDisplayOrder(inModule);
  return questions.update(id, { ...values, displayOrder });
}

export async function setQuestionActive(actor: Principal, id: ID, active: boolean): Promise<Question> {
  requireAdmin(actor);
  orNotFound(await questions.get(id), "Question", id);
  return questions.update(id, { active });
}

/** Moves a question one place up or down within its module. */
export async function moveQuestion(actor: Principal, id: ID, direction: MoveDirection): Promise<void> {
  requireAdmin(actor);
  const question = orNotFound(await questions.get(id), "Question", id);
  const changes = moveInOrder(await questions.list({ moduleId: question.moduleId }), id, direction);
  await Promise.all(changes.map((c) => questions.update(c.id, { displayOrder: c.displayOrder })));
}

/** Permanently deletes a question that has never been answered; answered questions can only be deactivated. */
export async function deleteQuestion(actor: Principal, id: ID): Promise<void> {
  requireAdmin(actor);
  orNotFound(await questions.get(id), "Question", id);
  if (await questions.isAnswered(id)) {
    throw new RepositoryError("CONFLICT", "This question has been answered, so it can only be deactivated.");
  }
  await questions.remove(id);
}
