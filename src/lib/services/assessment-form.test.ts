import { beforeEach, describe, expect, it } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import {
  COMMENT_MAX_LENGTH,
  clearAnswer,
  deleteAnswerPhoto,
  loadAssessmentForm,
  missingEvidence,
  saveAnswer,
  scoreAnswers,
  startAssessment,
  submitAssessment,
  unansweredQuestions,
  uploadAnswerPhoto,
} from "@/lib/services/assessments";
import type { Principal } from "@/lib/services/permissions";
import type { Answer, Assessment, ObservationTag } from "@/lib/types";

const owner: Principal = { id: "usr-wkr-blessing", role: "WORKER", status: "ACTIVE" };
const other: Principal = { id: "usr-wkr-emeka", role: "WORKER", status: "ACTIVE" };
const admin: Principal = { id: "usr-admin", role: "ADMIN", status: "ACTIVE" };

// Security on a PSV, self assessment: q-security-01..05; 01 and 04 are critical (weight 2).
async function securityDraft(): Promise<Assessment> {
  return startAssessment(owner, {
    kind: "MODULE",
    moduleId: "mod-security",
    vesselId: "ves-lady-perpetual",
    locationId: "loc-bonny",
    auditTypeId: "at-self-assessment",
  });
}

async function answerAll(assessment: Assessment, answers: Answer[]) {
  const form = await loadAssessmentForm(owner, assessment.id);
  const questions = form.sections.flatMap((s) => s.questions);
  for (const [index, question] of questions.entries()) {
    await saveAnswer(owner, {
      assessmentId: assessment.id,
      questionId: question.id,
      answer: answers[index] ?? "YES",
      comment: "",
      observationTag: null,
    });
  }
  return questions;
}

const jpeg = (bytes = "jpeg") => new Blob([bytes], { type: "image/jpeg" });

/** Uploads `count` photos and saves them on the answer to `questionId`. */
async function attachPhotos(assessment: Assessment, questionId: string, answer: Answer, count: number) {
  const ids = [];
  for (let i = 0; i < count; i += 1) ids.push((await uploadAnswerPhoto(owner, assessment.id, jpeg())).id);
  await saveAnswer(owner, { assessmentId: assessment.id, questionId, answer, comment: "", observationTag: null, photoIds: ids });
  return ids;
}

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("loading the form", () => {
  it("returns the applicable questions per module and marks the owner's draft editable", async () => {
    const draft = await securityDraft();
    const form = await loadAssessmentForm(owner, draft.id);
    expect(form.sections).toHaveLength(1);
    expect(form.sections[0].questions.map((q) => q.id)).toEqual([
      "q-security-01",
      "q-security-02",
      "q-security-03",
      "q-security-04",
      "q-security-05",
    ]);
    expect(form.editable).toBe(true);
    expect((await loadAssessmentForm(admin, draft.id)).editable).toBe(false);
  });

  it("groups a Full Vessel Assurance by module and skips barge-inapplicable questions", async () => {
    const draft = await startAssessment(admin, {
      kind: "FULL_VESSEL",
      moduleId: "",
      vesselId: "ves-greenbarge-2",
      locationId: "loc-bonga",
      auditTypeId: "at-mfe",
    });
    const form = await loadAssessmentForm(admin, draft.id);
    expect(form.sections).toHaveLength(12);
    expect(form.sections.find((s) => s.module.id === "mod-navigation-watch")?.questions).toHaveLength(0);
  });
});

describe("saving answers", () => {
  it("saves, replaces and clears an answer, keeping comment and tag", async () => {
    const draft = await securityDraft();
    const input = { assessmentId: draft.id, questionId: "q-security-02", comment: "  Register up to date  ", observationTag: "GOOD_PRACTICE" as const };
    await saveAnswer(owner, { ...input, answer: "CONCERN" });
    const saved = await saveAnswer(owner, { ...input, answer: "YES" });
    expect(saved).toMatchObject({ answer: "YES", comment: "Register up to date", observationTag: "GOOD_PRACTICE" });
    expect(await repo.responses.listByAssessment(draft.id)).toHaveLength(1);

    await clearAnswer(owner, draft.id, "q-security-02");
    expect(await repo.responses.listByAssessment(draft.id)).toHaveLength(0);
  });

  it("only lets the owner answer", async () => {
    const draft = await securityDraft();
    const input = { assessmentId: draft.id, questionId: "q-security-01", answer: "YES" as const, comment: "", observationTag: null };
    await expect(saveAnswer(other, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(saveAnswer(admin, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates the input in the service, not just the form", async () => {
    const draft = await securityDraft();
    const input = { assessmentId: draft.id, questionId: "q-security-01", answer: "YES" as const, comment: "", observationTag: null };
    const invalid = { name: "ValidationError" };
    await expect(saveAnswer(owner, { ...input, comment: "x".repeat(COMMENT_MAX_LENGTH + 1) })).rejects.toMatchObject(invalid);
    await expect(saveAnswer(owner, { ...input, answer: "MAYBE" as Answer })).rejects.toMatchObject(invalid);
    await expect(saveAnswer(owner, { ...input, observationTag: "BRILLIANT" as ObservationTag })).rejects.toMatchObject(invalid);
    // A question from another module, a missing one, and a deactivated one.
    await expect(saveAnswer(owner, { ...input, questionId: "q-galley-01" })).rejects.toMatchObject(invalid);
    await expect(saveAnswer(owner, { ...input, questionId: "q-nope" })).rejects.toMatchObject(invalid);
    await repo.questions.update("q-security-02", { active: false });
    await expect(saveAnswer(owner, { ...input, questionId: "q-security-02" })).rejects.toMatchObject(invalid);
    expect(await repo.responses.listByAssessment(draft.id)).toHaveLength(0);
  });
});

describe("submitting", () => {
  it("is blocked until every question has an answer", async () => {
    const draft = await securityDraft();
    await saveAnswer(owner, { assessmentId: draft.id, questionId: "q-security-01", answer: "YES", comment: "", observationTag: null });
    await expect(submitAssessment(owner, draft.id)).rejects.toMatchObject({
      name: "ValidationError",
      message: "4 questions still need an answer before you can submit.",
    });
    const form = await loadAssessmentForm(owner, draft.id);
    expect(unansweredQuestions(form.sections, form.responses)).toHaveLength(4);
  });

  it("scores in the service, matching the live review score", async () => {
    const draft = await securityDraft();
    // q01 critical w2 YES, q02 w1 CONCERN, q03 w1 NO, q04 critical w2 NA, q05 w1 YES → (2 + 0.5 + 0 + 1) / 5 = 70%
    await answerAll(draft, ["YES", "CONCERN", "NO", "NA", "YES"]);
    await attachPhotos(draft, "q-security-02", "CONCERN", 1); // evidence required on a Concern
    const form = await loadAssessmentForm(owner, draft.id);
    expect(scoreAnswers(form.sections, form.responses).overall).toBe(70);

    const submitted = await submitAssessment(owner, draft.id);
    expect(submitted).toMatchObject({ status: "SUBMITTED", overallScore: 70, moduleScores: { "mod-security": 70 } });
  });

  it("gives an all-N/A assessment no score", async () => {
    const draft = await securityDraft();
    await answerAll(draft, ["NA", "NA", "NA", "NA", "NA"]);
    expect(await submitAssessment(owner, draft.id)).toMatchObject({ overallScore: null });
  });

  it("records Good Practice answers as positive interventions", async () => {
    const draft = await securityDraft();
    await answerAll(draft, []);
    await saveAnswer(owner, {
      assessmentId: draft.id,
      questionId: "q-security-03",
      answer: "YES",
      comment: "Crew ran an unannounced security drill",
      observationTag: "GOOD_PRACTICE",
    });
    await saveAnswer(owner, {
      assessmentId: draft.id,
      questionId: "q-security-05",
      answer: "YES",
      comment: "",
      observationTag: "IMPROVEMENT",
    });
    await submitAssessment(owner, draft.id);

    const recorded = await repo.positiveInterventions.list({ assessmentId: draft.id });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ description: "Crew ran an unannounced security drill", moduleId: "mod-security" });
  });

  it("makes the assessment read-only afterwards", async () => {
    const draft = await securityDraft();
    await answerAll(draft, []);
    await submitAssessment(owner, draft.id);

    expect((await loadAssessmentForm(owner, draft.id)).editable).toBe(false);
    await expect(
      saveAnswer(owner, { assessmentId: draft.id, questionId: "q-security-01", answer: "NO", comment: "", observationTag: null }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(submitAssessment(owner, draft.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("ignores answers to questions that stopped applying", async () => {
    const draft = await securityDraft();
    await answerAll(draft, ["NO", "YES", "YES", "YES", "YES"]);
    await repo.questions.update("q-security-01", { active: false }); // the "NO" no longer counts
    expect(await submitAssessment(owner, draft.id)).toMatchObject({ overallScore: 100 });
  });
});

// q-security-02 ("visitor register") is evidence-required; q-security-01 is not.
describe("photos", () => {
  it("attaches photos in order and keeps them when the answer changes without a photo list", async () => {
    const draft = await securityDraft();
    const ids = await attachPhotos(draft, "q-security-02", "NO", 3);
    const changed = await saveAnswer(owner, {
      assessmentId: draft.id,
      questionId: "q-security-02",
      answer: "CONCERN",
      comment: "",
      observationTag: null,
    });
    expect(changed.photoIds).toEqual(ids);
  });

  it("allows at most 5 photos per answer", async () => {
    const draft = await securityDraft();
    await attachPhotos(draft, "q-security-02", "NO", 5);
    await expect(attachPhotos(draft, "q-security-03", "NO", 6)).rejects.toMatchObject({
      name: "ValidationError",
      message: "An answer can have at most 5 photos.",
    });
  });

  it("rejects unknown or duplicated photo ids", async () => {
    const draft = await securityDraft();
    const base = { assessmentId: draft.id, questionId: "q-security-01", answer: "YES" as const, comment: "", observationTag: null };
    await expect(saveAnswer(owner, { ...base, photoIds: ["missing-photo"] })).rejects.toMatchObject({ name: "ValidationError" });
    const { id } = await uploadAnswerPhoto(owner, draft.id, jpeg());
    await expect(saveAnswer(owner, { ...base, photoIds: [id, id] })).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("only lets the draft's owner upload, and only images", async () => {
    const draft = await securityDraft();
    await expect(uploadAnswerPhoto(admin, draft.id, jpeg())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(uploadAnswerPhoto(owner, draft.id, new Blob(["x"], { type: "application/pdf" }))).rejects.toMatchObject({
      name: "ValidationError",
    });
    await expect(uploadAnswerPhoto(owner, draft.id, new Blob([], { type: "image/jpeg" }))).rejects.toMatchObject({
      name: "ValidationError",
    });
  });

  it("deletes a photo only once no saved answer uses it", async () => {
    const draft = await securityDraft();
    const [keep, drop] = await attachPhotos(draft, "q-security-02", "NO", 2);
    await expect(deleteAnswerPhoto(owner, draft.id, drop)).rejects.toMatchObject({ code: "CONFLICT" });

    await saveAnswer(owner, {
      assessmentId: draft.id,
      questionId: "q-security-02",
      answer: "NO",
      comment: "",
      observationTag: null,
      photoIds: [keep],
    });
    await deleteAnswerPhoto(owner, draft.id, drop);
    expect(await repo.photos.getMeta(drop)).toBeNull();
    expect(await repo.photos.getMeta(keep)).not.toBeNull();
  });

  it("cannot change photos after submit", async () => {
    const draft = await securityDraft();
    const [photo] = await attachPhotos(draft, "q-security-01", "YES", 1);
    await answerAll(draft, ["YES"]);
    await submitAssessment(owner, draft.id);
    await expect(uploadAnswerPhoto(owner, draft.id, jpeg())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteAnswerPhoto(owner, draft.id, photo)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("evidence required", () => {
  it.each([
    ["NO", true],
    ["CONCERN", true],
    ["YES", false],
    ["NA", false],
  ] as const)("a %s answer without a photo is missing evidence: %s", async (answer, missing) => {
    const draft = await securityDraft();
    await answerAll(draft, ["YES", answer]);
    const form = await loadAssessmentForm(owner, draft.id);
    expect(missingEvidence(form.sections, form.responses).map((q) => q.id)).toEqual(missing ? ["q-security-02"] : []);
  });

  it("ignores questions that don't require evidence", async () => {
    const draft = await securityDraft();
    await answerAll(draft, ["NO", "YES", "NO", "NO", "NO"]);
    const form = await loadAssessmentForm(owner, draft.id);
    expect(missingEvidence(form.sections, form.responses)).toEqual([]);
  });

  it("blocks submit until the photo is attached", async () => {
    const draft = await securityDraft();
    await answerAll(draft, ["YES", "NO"]);
    await expect(submitAssessment(owner, draft.id)).rejects.toMatchObject({
      name: "ValidationError",
      message: "1 question still needs a photo before you can submit.",
    });

    await attachPhotos(draft, "q-security-02", "NO", 1);
    expect(await submitAssessment(owner, draft.id)).toMatchObject({ status: "SUBMITTED" });
  });
});
