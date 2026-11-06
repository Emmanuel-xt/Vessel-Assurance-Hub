// MOCK: assessments and their responses.

import {
  RepositoryError,
  type AssessmentCreateInput,
  type AssessmentFilter,
  type AssessmentPatch,
  type AssessmentsRepository,
  type ResponseCreateInput,
  type ResponsePatch,
  type ResponsesRepository,
} from "@/lib/data/repositories";
import { formatReference, referenceYear, sequenceKey } from "@/lib/services/references";
import type { Assessment, ID, Response } from "@/lib/types";
import { crud, requireRow, rows } from "./crud";
import { removePhoto } from "./photo-store";
import { db, nextSequence, persist } from "./store";
import { clone, newId, nowIso, simulateLatency } from "./utils";

function nextAssessmentReference(): string {
  const year = referenceYear(new Date());
  return formatReference("assessment", year, nextSequence(sequenceKey("assessment", year)));
}

function assertDraft(assessment: Assessment) {
  if (assessment.status !== "DRAFT") {
    throw new RepositoryError("CONFLICT", `Assessment ${assessment.reference} is already submitted`);
  }
}

// ---------- Assessments ----------

const assessmentsCrud = crud<"assessments", AssessmentCreateInput, AssessmentFilter, AssessmentPatch>("assessments", {
  entity: "Assessment",
  build: (input) => {
    if (input.moduleIds.length === 0) throw new RepositoryError("VALIDATION", "An assessment needs at least one module");
    const user = requireRow("users", input.userId, "User");
    const vessel = requireRow("vessels", input.vesselId, "Vessel");
    const now = nowIso();
    return {
      ...input,
      startWork: input.startWork ? { ...input.startWork } : null,
      id: newId(),
      reference: nextAssessmentReference(),
      status: "DRAFT",
      overallScore: null,
      moduleScores: {},
      snapshot: {
        userName: user.name,
        company: user.company,
        position: user.position,
        vesselName: vessel.name,
        packageId: vessel.packageId,
      },
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
    };
  },
  matches: (a, f) =>
    (!f.userId || a.userId === f.userId) && (!f.status || a.status === f.status) && (!f.vesselId || a.vesselId === f.vesselId),
  compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  beforeUpdate: (row) => assertDraft(row),
  afterUpdate: (row) => {
    row.updatedAt = nowIso();
  },
});

export const assessments: AssessmentsRepository = {
  ...assessmentsCrud,

  async listSubmitted(filter = {}) {
    await simulateLatency();
    const has = <T>(list: T[] | undefined, value: T) => !list || list.length === 0 || list.includes(value);
    const result = rows("assessments")
      .filter(
        (a) =>
          a.status === "SUBMITTED" &&
          a.submittedAt !== null &&
          has(filter.vesselIds, a.vesselId) &&
          has(filter.locationIds, a.locationId) &&
          has(filter.packageIds, a.snapshot.packageId) &&
          has(filter.auditTypeIds, a.auditTypeId) &&
          has(filter.kinds, a.kind) &&
          has(filter.companies, a.snapshot.company) &&
          (!filter.moduleId || a.moduleIds.includes(filter.moduleId)) &&
          (!filter.userId || a.userId === filter.userId) &&
          (!filter.from || a.submittedAt >= filter.from) &&
          (!filter.to || a.submittedAt <= filter.to),
      )
      .sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!));
    return clone(result);
  },

  async submit(id, scores) {
    await simulateLatency();
    const assessment = requireRow("assessments", id, "Assessment");
    assertDraft(assessment);
    const now = nowIso();
    assessment.status = "SUBMITTED";
    assessment.overallScore = scores.overallScore;
    assessment.moduleScores = { ...scores.moduleScores };
    assessment.submittedAt = now;
    assessment.updatedAt = now;
    persist();
    return clone(assessment);
  },

  async removeDraft(id) {
    await simulateLatency();
    const assessment = requireRow("assessments", id, "Assessment");
    assertDraft(assessment);
    const data = db();
    const photoIds = data.responses.filter((r) => r.assessmentId === id).flatMap((r) => r.photoIds);
    data.responses = data.responses.filter((r) => r.assessmentId !== id);
    data.findingDrafts = data.findingDrafts.filter((d) => d.assessmentId !== id);
    data.assessments = data.assessments.filter((a) => a.id !== id);
    persist();
    await Promise.all(photoIds.map((photoId) => removePhoto(photoId).catch(() => undefined)));
  },
};

// ---------- Responses ----------

/** Validates that the question can be answered in this draft and returns the stored fields derived from it. */
function questionFields(assessmentId: ID, questionId: ID) {
  const assessment = requireRow("assessments", assessmentId, "Assessment");
  assertDraft(assessment);
  const question = requireRow("questions", questionId, "Question");
  if (!assessment.moduleIds.includes(question.moduleId)) {
    throw new RepositoryError("VALIDATION", `Question ${questionId} is not part of this assessment's modules`);
  }
  return {
    moduleId: question.moduleId,
    questionSnapshot: { text: question.text, weight: question.weight, criticalControl: question.criticalControl },
  };
}

function touchAssessment(assessmentId: ID) {
  requireRow("assessments", assessmentId, "Assessment").updatedAt = nowIso();
}

const responsesCrud = crud<"responses", ResponseCreateInput, { assessmentId?: ID }, ResponsePatch>("responses", {
  entity: "Response",
  build: (input) => {
    const now = nowIso();
    const response: Response = {
      ...input,
      ...questionFields(input.assessmentId, input.questionId),
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    touchAssessment(input.assessmentId);
    return response;
  },
  matches: (r, f) => !f.assessmentId || r.assessmentId === f.assessmentId,
  beforeUpdate: (row) => assertDraft(requireRow("assessments", row.assessmentId, "Assessment")),
  afterUpdate: (row) => {
    row.updatedAt = nowIso();
    touchAssessment(row.assessmentId);
  },
});

const byQuestionOrder = (a: Response, b: Response) => {
  const order = (r: Response) => rows("questions").find((q) => q.id === r.questionId)?.displayOrder ?? 0;
  return a.moduleId.localeCompare(b.moduleId) || order(a) - order(b);
};

export const responses: ResponsesRepository = {
  ...responsesCrud,

  async listByAssessment(assessmentId) {
    const list = await responsesCrud.list({ assessmentId });
    return list.sort(byQuestionOrder);
  },

  async upsert(input) {
    const existing = rows("responses").find(
      (r) => r.assessmentId === input.assessmentId && r.questionId === input.questionId,
    );
    if (!existing) return responsesCrud.create(input);
    const { answer, comment, observationTag, photoIds } = input;
    return responsesCrud.update(existing.id, { answer, comment, observationTag, photoIds });
  },

  async remove(id) {
    await simulateLatency();
    const response = requireRow("responses", id, "Response");
    assertDraft(requireRow("assessments", response.assessmentId, "Assessment"));
    const data = db();
    data.responses = data.responses.filter((r) => r.id !== id);
    touchAssessment(response.assessmentId);
    persist();
  },
};
