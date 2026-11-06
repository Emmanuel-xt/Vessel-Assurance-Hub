// Findings raised during an assessment (CLAUDE.md §5, §9).
//
// While drafting, findings are kept as FindingDrafts. When the assessment is submitted each draft becomes a Finding
// ("VAH-F-YYYY-NNNN") with a first action ("…-A1") for the chosen owner and target date, an activity log entry and
// in-app notifications. A "No" on a critical-control question must have a High-risk finding (design document).

import { z } from "zod";
import {
  actions,
  findingActivities,
  findingDrafts,
  findings,
  notifications,
  questions,
  RepositoryError,
  users,
} from "@/lib/data";
import { formatCalendarDate } from "@/lib/format";
import { getAssessmentForUser, requireEditableDraft } from "@/lib/services/assessment-access";
import type { FormSection } from "@/lib/services/assessments";
import { parseOrThrow, ValidationError } from "@/lib/services/errors";
import { businessToday } from "@/lib/services/overdue";
import { requireUser, type Principal } from "@/lib/services/permissions";
import type {
  Action,
  Answer,
  Assessment,
  Finding,
  FindingDraft,
  ID,
  ISODate,
  Question,
  Response,
  RiskLevel,
} from "@/lib/types";

// ---------- Labels and defaults ----------

export const RISK_LEVELS: readonly RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

export const RISK_LABELS: Record<RiskLevel, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

/** Default target date, in days from today: High +7, Medium +14, Low +30. */
export const TARGET_DAYS: Record<RiskLevel, number> = { HIGH: 7, MEDIUM: 14, LOW: 30 };

export const FINDING_DESCRIPTION_LENGTH = { min: 5, max: 500 } as const;

/** Calendar arithmetic on "YYYY-MM-DD" dates (no time zone involved). */
export function addDays(date: ISODate, days: number): ISODate {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Today in Lagos plus the risk's number of days. */
export function defaultTargetDate(risk: RiskLevel, now: Date = new Date()): ISODate {
  return addDays(businessToday(now), TARGET_DAYS[risk]);
}

// ---------- When a finding is offered or required ----------

/** Answers a finding can be raised against: No opens the sheet, Concern offers a button. */
export const FINDING_ANSWERS: readonly Answer[] = ["NO", "CONCERN"];

export const canRaiseFindingFor = (answer: Answer | null | undefined) => answer != null && FINDING_ANSWERS.includes(answer);

/** A "No" opens the Raise finding sheet straight away. */
export const opensFindingSheet = (answer: Answer | null | undefined) => answer === "NO";

/** Critical control answered No: a High-risk finding with an action owner is mandatory. */
export function requiresFinding(question: Pick<Question, "criticalControl">, answer: Answer | null | undefined): boolean {
  return question.criticalControl && answer === "NO";
}

type AnswerLike = Pick<Response, "answer"> | undefined;
type DraftLike = Pick<FindingDraft, "questionId" | "risk">;

/** Critical controls answered No that do not yet have a High-risk finding. These block submit. */
export function findingsRequired(sections: FormSection[], answers: Record<ID, AnswerLike>, drafts: DraftLike[]): Question[] {
  return sections.flatMap((s) =>
    s.questions.filter(
      (q) => requiresFinding(q, answers[q.id]?.answer) && !drafts.some((d) => d.questionId === q.id && d.risk === "HIGH"),
    ),
  );
}

/** Other "No" answers without a finding. Allowed, but the user confirms before submitting. */
export function noAnswersWithoutFinding(sections: FormSection[], answers: Record<ID, AnswerLike>, drafts: DraftLike[]): Question[] {
  return sections.flatMap((s) =>
    s.questions.filter(
      (q) => answers[q.id]?.answer === "NO" && !q.criticalControl && !drafts.some((d) => d.questionId === q.id),
    ),
  );
}

// ---------- Owners ----------

export interface AssignableUser {
  id: ID;
  name: string;
  company: string;
  position: string;
}

/** Active users who can own an action, by name. Only what the picker needs (no email, no password). */
export async function listAssignableUsers(actor: Principal): Promise<AssignableUser[]> {
  requireUser(actor);
  const active = await users.list({ status: "ACTIVE" });
  return active
    .map(({ id, name, company, position }) => ({ id, name, company, position }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Findings prepared on a draft ----------

export const findingDraftSchema = z.object({
  description: z
    .string()
    .trim()
    .min(FINDING_DESCRIPTION_LENGTH.min, { error: "Describe the finding (at least 5 characters)" })
    .max(FINDING_DESCRIPTION_LENGTH.max, { error: `Keep it under ${FINDING_DESCRIPTION_LENGTH.max} characters` }),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"], { error: "Choose a risk level" }),
  ownerId: z.string().min(1, { error: "Choose an owner" }),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a target date" }),
});

export type FindingDraftValues = z.input<typeof findingDraftSchema>;

/** Validates the fields, then checks the owner is an active user and the date is not in the past. */
async function checkDraftValues(values: FindingDraftValues, today: ISODate = businessToday()) {
  const parsed = parseOrThrow(findingDraftSchema, values);
  if (parsed.targetDate < today) {
    throw new ValidationError("Please fix the highlighted fields.", { targetDate: "The target date can't be in the past" });
  }
  const owner = await users.get(parsed.ownerId);
  if (!owner || owner.status !== "ACTIVE") {
    throw new ValidationError("Please fix the highlighted fields.", { ownerId: "Choose an active user" });
  }
  return parsed;
}

async function requireDraftFinding(actor: Principal, draftId: ID): Promise<FindingDraft> {
  const draft = await findingDrafts.get(draftId);
  if (!draft) throw new RepositoryError("NOT_FOUND", "This finding no longer exists.");
  await requireEditableDraft(actor, draft.assessmentId);
  return draft;
}

/** Findings prepared on an assessment (visible to whoever may open the assessment). */
export async function listFindingDrafts(actor: Principal, assessmentId: ID): Promise<FindingDraft[]> {
  await getAssessmentForUser(actor, assessmentId);
  return findingDrafts.listByAssessment(assessmentId);
}

/**
 * Prepares a finding on the actor's draft: against a question (one per question) or general (questionId null).
 */
export async function addFindingDraft(
  actor: Principal,
  assessmentId: ID,
  questionId: ID | null,
  values: FindingDraftValues,
): Promise<FindingDraft> {
  const assessment = await requireEditableDraft(actor, assessmentId);
  if (questionId) {
    const question = await questions.get(questionId);
    if (!question || !assessment.moduleIds.includes(question.moduleId)) {
      throw new ValidationError("This question is not part of the assessment.");
    }
    const existing = await findingDrafts.listByAssessment(assessmentId);
    if (existing.some((d) => d.questionId === questionId)) {
      throw new RepositoryError("CONFLICT", "This question already has a finding. Edit that one instead.");
    }
  }
  const valid = await checkDraftValues(values);
  return findingDrafts.create({ assessmentId, questionId, ...valid });
}

export async function updateFindingDraft(actor: Principal, draftId: ID, values: FindingDraftValues): Promise<FindingDraft> {
  await requireDraftFinding(actor, draftId);
  return findingDrafts.update(draftId, await checkDraftValues(values));
}

export async function removeFindingDraft(actor: Principal, draftId: ID): Promise<void> {
  await requireDraftFinding(actor, draftId);
  await findingDrafts.remove(draftId);
}

// ---------- At submit ----------

const shorten = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Runs before the assessment is submitted, so nothing is half-done if a finding is invalid:
 * critical controls answered No need a High-risk finding, and every prepared finding must still be valid
 * (owner still active, target date not passed).
 */
export async function checkFindingsBeforeSubmit(
  sections: FormSection[],
  answers: Record<ID, AnswerLike>,
  drafts: FindingDraft[],
): Promise<void> {
  const required = findingsRequired(sections, answers, drafts);
  if (required.length > 0) {
    const noun = required.length === 1 ? "critical control answered No needs" : "critical controls answered No need";
    throw new ValidationError(`${required.length} ${noun} a High-risk finding before you can submit.`);
  }
  const today = businessToday();
  for (const draft of drafts) {
    try {
      await checkDraftValues(draft, today);
    } catch {
      throw new ValidationError(
        `Update the finding "${shorten(draft.description)}" before you can submit: check its owner and target date.`,
      );
    }
  }
}

/**
 * Turns the prepared findings into findings with action A1, logs who did what, notifies, then removes the drafts.
 * The assessment must already be SUBMITTED. Production: run in the same server transaction as the submit.
 */
export async function raiseDraftFindings(
  raiser: Principal,
  assessment: Assessment,
  drafts: FindingDraft[],
  responses: Response[],
): Promise<Finding[]> {
  const raised: Finding[] = [];
  const admins = drafts.some((d) => d.risk === "HIGH") ? await users.list({ status: "ACTIVE", role: "ADMIN" }) : [];

  for (const draft of drafts) {
    const response = draft.questionId ? responses.find((r) => r.questionId === draft.questionId) : undefined;
    const finding = await findings.create({
      assessmentId: assessment.id,
      responseId: response?.id ?? null,
      description: draft.description,
      risk: draft.risk,
      critical: response?.questionSnapshot.criticalControl ?? false,
      raisedById: raiser.id,
    });
    const action = await actions.create({
      findingId: finding.id,
      description: draft.description,
      ownerId: draft.ownerId,
      targetDate: draft.targetDate,
      createdById: raiser.id,
    });
    const owner = await users.get(draft.ownerId);

    await findingActivities.create({
      findingId: finding.id,
      actionId: null,
      userId: raiser.id,
      type: "RAISED",
      note: `Raised from ${assessment.reference} (${RISK_LABELS[finding.risk]} risk)`,
    });
    await findingActivities.create({
      findingId: finding.id,
      actionId: action.id,
      userId: raiser.id,
      type: "ACTION_ADDED",
      note: `${action.reference} assigned to ${owner?.name ?? "unknown user"}, due ${formatCalendarDate(action.targetDate)}`,
    });

    await notify(raiser, assessment, finding, action, admins);
    await findingDrafts.remove(draft.id);
    raised.push(finding);
  }
  return raised;
}

/** High risk → every active admin; the action owner is told about the action. Nobody is notified of their own entry. */
async function notify(raiser: Principal, assessment: Assessment, finding: Finding, action: Action, admins: { id: ID }[]) {
  const link = `/findings/${finding.id}`;
  const vessel = assessment.snapshot.vesselName;
  if (finding.risk === "HIGH") {
    for (const admin of admins) {
      if (admin.id === raiser.id || admin.id === action.ownerId) continue;
      await notifications.create({
        userId: admin.id,
        type: "HIGH_RISK_FINDING",
        title: `High-risk finding ${finding.reference}`,
        body: `${vessel}: ${finding.description}`,
        link,
      });
    }
  }
  if (action.ownerId !== raiser.id) {
    await notifications.create({
      userId: action.ownerId,
      type: "ACTION_ASSIGNED",
      title: `${finding.risk === "HIGH" ? "High-risk action" : "Action"} ${action.reference} assigned to you`,
      body: `${vessel}: ${finding.description} Due ${formatCalendarDate(action.targetDate)}.`,
      link,
    });
  }
}

// ---------- Reading raised findings ----------

export interface RaisedFinding {
  finding: Finding;
  actions: (Action & { ownerName: string })[];
}

/** Findings recorded against an assessment, with their actions and owner names, by reference. */
export async function listAssessmentFindings(actor: Principal, assessmentId: ID): Promise<RaisedFinding[]> {
  await getAssessmentForUser(actor, assessmentId);
  const [list, people] = await Promise.all([findings.list({ assessmentId }), users.list()]);
  const nameOf = (id: ID) => people.find((u) => u.id === id)?.name ?? "Unknown user";
  const result = await Promise.all(
    list.map(async (finding) => ({
      finding,
      actions: (await actions.list({ findingId: finding.id })).map((a) => ({ ...a, ownerName: nameOf(a.ownerId) })),
    })),
  );
  return result.sort((a, b) => a.finding.reference.localeCompare(b.finding.reference));
}
