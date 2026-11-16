import { beforeEach, describe, expect, it } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import {
  answerLongLabelsFor,
  answerOptionsFor,
  loadAssessmentForm,
  saveAnswer,
  startAssessment,
  stopWorkItems,
  submitAssessment,
} from "@/lib/services/assessments";
import { deleteMyDraft } from "@/lib/services/assessment-lists";
import { addFindingDraft, defaultTargetDate } from "@/lib/services/findings";
import { JOIN_CODE_ALPHABET, formatJoinCode, normalizeJoinCode } from "@/lib/services/join-codes";
import type { Principal } from "@/lib/services/permissions";
import {
  closeActivity,
  createActivity,
  verifyParticipant,
  findActivityByCode,
  joinActivity,
  listActivities,
  loadActivity,
  type ActivitySetupValues,
} from "@/lib/services/start-work-activities";
import type { Answer, Assessment, StartWorkActivity } from "@/lib/types";

const auditor: Principal = { id: "usr-aud-kemi", role: "AUDITOR", status: "ACTIVE" };
const otherAuditor: Principal = { id: "usr-aud-musa", role: "AUDITOR", status: "ACTIVE" };
const admin: Principal = { id: "usr-admin", role: "ADMIN", status: "ACTIVE" };
const supervisor: Principal = { id: "usr-sup-tunde", role: "SUPERVISOR", status: "ACTIVE" };
const crew: Principal = { id: "usr-wkr-ibrahim", role: "WORKER", status: "ACTIVE" };
const mate: Principal = { id: "usr-wkr-esther", role: "WORKER", status: "ACTIVE" };
const third: Principal = { id: "usr-wkr-bassey", role: "WORKER", status: "ACTIVE" };

// Hot Work (the IOGP sheet): q-hot-work-01..06; 03 gas test, 05 ignition sources and 06 flammables are critical (w2).
const setup = (overrides: Partial<ActivitySetupValues> = {}): ActivitySetupValues => ({
  moduleId: "mod-hot-work",
  vesselId: "ves-lady-perpetual",
  locationId: "loc-marconi",
  taskDescription: "  Weld new bracket on the aft deck  ",
  teamSize: 2,
  ...overrides,
});

async function openActivity(overrides: Partial<ActivitySetupValues> = {}): Promise<StartWorkActivity> {
  return createActivity(auditor, setup(overrides));
}

async function answerAll(actor: Principal, assessment: Assessment, answers: Partial<Record<number, Answer>>) {
  const form = await loadAssessmentForm(actor, assessment.id);
  const questions = form.sections.flatMap((s) => s.questions);
  for (const [index, question] of questions.entries()) {
    await saveAnswer(actor, {
      assessmentId: assessment.id,
      questionId: question.id,
      answer: answers[index + 1] ?? "YES",
      comment: index === 1 ? "No toolbox talk held" : "",
      observationTag: null,
    });
  }
}

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("join codes", () => {
  it("normalises typed codes and formats them for reading out", () => {
    expect(normalizeJoinCode(" k7p-4qx ")).toBe("K7P4QX");
    expect(formatJoinCode("K7P4QX")).toBe("K7P-4QX");
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
});

describe("setting up a Start Work Check", () => {
  it("is for auditors and admins, with a reference, a join code and the job details", async () => {
    const activity = await openActivity();
    expect(activity).toMatchObject({
      reference: expect.stringMatching(/^VAH-S-\d{4}-0001$/),
      code: expect.stringMatching(/^[A-Z2-9]{6}$/),
      status: "OPEN",
      taskDescription: "Weld new bracket on the aft deck",
      teamSize: 2,
      createdById: auditor.id,
      snapshot: { vesselName: "Lady Perpetual", createdByName: "Kemi Olatunji" },
    });
    expect(await createActivity(admin, setup())).toMatchObject({ reference: expect.stringMatching(/-0002$/) });
    for (const actor of [crew, supervisor]) {
      await expect(createActivity(actor, setup())).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("requires a Start Work task, a job description and 1–99 people", async () => {
    const fieldError = (field: string) => ({ name: "ValidationError", fieldErrors: { [field]: expect.any(String) } });
    await expect(openActivity({ taskDescription: " " })).rejects.toMatchObject(fieldError("taskDescription"));
    await expect(openActivity({ taskDescription: "x".repeat(201) })).rejects.toMatchObject(fieldError("taskDescription"));
    for (const teamSize of [0, 2.5, 100, Number.NaN]) {
      await expect(openActivity({ teamSize })).rejects.toMatchObject(fieldError("teamSize"));
    }
    await expect(openActivity({ moduleId: "mod-security" })).rejects.toMatchObject(fieldError("moduleId"));
  });

  it("no longer lets anyone start a Start Work Check on their own", async () => {
    await expect(
      startAssessment(crew, {
        kind: "START_WORK" as "MODULE",
        moduleId: "mod-hot-work",
        vesselId: "ves-lady-perpetual",
        locationId: "loc-marconi",
        auditTypeId: "at-start-work-check",
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });
});

describe("joining", () => {
  it("finds a check by code, gives each person their own check with the auditor's details", async () => {
    const activity = await openActivity();
    expect((await findActivityByCode(crew, formatJoinCode(activity.code).toLowerCase())).id).toBe(activity.id);
    await expect(findActivityByCode(crew, "ABC")).rejects.toMatchObject({ fieldErrors: { code: expect.any(String) } });
    await expect(findActivityByCode(crew, "ZZZZZZ")).rejects.toMatchObject({ fieldErrors: { code: expect.any(String) } });

    const check = await joinActivity(crew, activity.id);
    expect(check).toMatchObject({
      kind: "START_WORK",
      status: "DRAFT",
      userId: crew.id,
      moduleIds: ["mod-hot-work"],
      vesselId: "ves-lady-perpetual",
      locationId: "loc-marconi",
      auditTypeId: "at-start-work-check",
      activityId: activity.id,
      startWork: { taskDescription: "Weld new bracket on the aft deck", teamSize: 2 },
    });
    // Joining again returns the same check.
    expect((await joinActivity(crew, activity.id)).id).toBe(check.id);
    // The auditor who set it up verifies it rather than answering it.
    await expect(joinActivity(auditor, activity.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await joinActivity(admin, activity.id)).toMatchObject({ userId: admin.id });
  });

  it("stops at the number of people the auditor set; a deleted draft frees the place", async () => {
    const activity = await openActivity({ teamSize: 2 });
    const first = await joinActivity(crew, activity.id);
    await joinActivity(mate, activity.id);
    await expect(joinActivity(third, activity.id)).rejects.toMatchObject({ code: "CONFLICT" });

    const [summary] = await listActivities(third, { status: "OPEN" });
    expect(summary).toMatchObject({ joined: 2, submitted: 0, mine: null, joinBlock: expect.stringContaining("All 2 places") });

    await deleteMyDraft(crew, first.id);
    expect(await joinActivity(third, activity.id)).toMatchObject({ userId: third.id });
  });
});

describe("closing", () => {
  it("is for the auditor who set it up (or an admin), records who and when, and stops joining and submitting", async () => {
    const activity = await openActivity({ teamSize: 3 });
    const done = await joinActivity(crew, activity.id);
    await answerAll(crew, done, {});
    await submitAssessment(crew, done.id);
    const late = await joinActivity(mate, activity.id);
    await answerAll(mate, late, {});

    // The verifier signs off each submitted check before the job can be closed.
    await expect(closeActivity(auditor, activity.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(verifyParticipant(otherAuditor, done.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(verifyParticipant(crew, done.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(verifyParticipant(auditor, late.id)).rejects.toMatchObject({ code: "CONFLICT" }); // not submitted
    const verified = await verifyParticipant(auditor, done.id);
    expect(verified.verification).toMatchObject({ verifiedById: auditor.id, verifiedByName: "Kemi Olatunji" });
    await expect(verifyParticipant(admin, done.id)).rejects.toMatchObject({ code: "CONFLICT" }); // only once

    await expect(closeActivity(otherAuditor, activity.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(closeActivity(crew, activity.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const closed = await closeActivity(auditor, activity.id, "  Cleared to start  ");
    expect(closed).toMatchObject({ status: "CLOSED", closedById: auditor.id, closureComment: "Cleared to start" });
    expect(closed.closedAt).not.toBeNull();

    await expect(submitAssessment(mate, late.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(joinActivity(third, activity.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(findActivityByCode(third, activity.code)).rejects.toMatchObject({ name: "ValidationError" });
    await expect(closeActivity(admin, activity.id)).rejects.toMatchObject({ code: "CONFLICT" });

    const detail = await loadActivity(auditor, activity.id);
    expect(detail).toMatchObject({ joined: 2, submitted: 1, canClose: false, closedByName: "Kemi Olatunji" });
    expect(detail.participants.map((p) => [p.assessment.userId, p.assessment.status, p.canOpen])).toEqual([
      [crew.id, "SUBMITTED", true],
      [mate.id, "DRAFT", false],
    ]);
    expect(detail.unverified).toBe(0);
    // Nothing can be verified once the job is closed.
    await expect(verifyParticipant(auditor, done.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets an admin close any check", async () => {
    const activity = await openActivity();
    expect((await loadActivity(admin, activity.id)).canClose).toBe(true);
    expect((await loadActivity(otherAuditor, activity.id)).canClose).toBe(false);
    expect(await closeActivity(admin, activity.id)).toMatchObject({ status: "CLOSED", closedById: admin.id });
  });
});

describe("Start Work Check answers", () => {
  it("offers Yes / No / N/A and labels them Compliant / Non-Compliant", () => {
    expect(answerOptionsFor("START_WORK")).toEqual(["YES", "NO", "NA"]);
    expect(answerOptionsFor("MODULE")).toEqual(["YES", "CONCERN", "NO", "NA"]);
    expect(answerLongLabelsFor("START_WORK")).toMatchObject({ YES: "Compliant", NO: "Non-Compliant" });
    expect(answerLongLabelsFor("MODULE")).toMatchObject({ YES: "Yes", NO: "No" });
  });

  it("rejects a Concern answer even if the screen is bypassed", async () => {
    const check = await joinActivity(crew, (await openActivity()).id);
    await expect(
      saveAnswer(crew, { assessmentId: check.id, questionId: "q-hot-work-01", answer: "CONCERN", comment: "", observationTag: null }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("lists the No items (Non-Compliant) that stop the job, and counts them on the activity", async () => {
    const activity = await openActivity();
    const check = await joinActivity(crew, activity.id);
    await answerAll(crew, check, { 2: "NO", 3: "NA", 4: "NO" });
    const form = await loadAssessmentForm(crew, check.id);
    expect(stopWorkItems(form.sections, form.responses).map((q) => q.id)).toEqual(["q-hot-work-02", "q-hot-work-04"]);

    for (const questionId of ["q-hot-work-02", "q-hot-work-04"]) {
      await addFindingDraft(crew, check.id, questionId, {
        description: "Not in place",
        risk: "HIGH",
        ownerId: crew.id,
        targetDate: defaultTargetDate("HIGH"),
      });
    }
    await submitAssessment(crew, check.id);
    expect((await loadActivity(auditor, activity.id)).participants[0].noCount).toBe(2);
  });
});

describe("submitting a Start Work Check", () => {
  it("is scored like any module and stored as a normal Start Work Check assessment", async () => {
    const check = await joinActivity(crew, (await openActivity({ teamSize: 4 })).id);
    // Weights: 01 w1, 02 w1, 03 w2, 04 w1, 05 w2, 06 w2 = 9; NO on 06 (w2) → 7/9 = 78%
    await answerAll(crew, check, { 6: "NO" });
    // q-hot-work-06 (flammables) is a critical control: a High-risk finding is required.
    await expect(submitAssessment(crew, check.id)).rejects.toMatchObject({ name: "ValidationError" });
    await addFindingDraft(crew, check.id, "q-hot-work-06", {
      description: "Paint drums left beside the welding bay",
      risk: "HIGH",
      ownerId: crew.id,
      targetDate: defaultTargetDate("HIGH"),
    });
    const submitted = await submitAssessment(crew, check.id);
    expect(submitted).toMatchObject({ status: "SUBMITTED", kind: "START_WORK", overallScore: 78, verification: null });

    const forDashboard = await repo.assessments.listSubmitted({ auditTypeIds: ["at-start-work-check"] });
    expect(forDashboard.map((a) => a.id)).toEqual([check.id]);
    expect(forDashboard[0].startWork).toEqual({ taskDescription: "Weld new bracket on the aft deck", teamSize: 4 });
  });
});
