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
  type AssessmentSetupValues,
} from "@/lib/services/assessments";
import { addFindingDraft, defaultTargetDate } from "@/lib/services/findings";
import type { Principal } from "@/lib/services/permissions";
import type { Answer, Assessment } from "@/lib/types";

const crew: Principal = { id: "usr-wkr-ibrahim", role: "WORKER", status: "ACTIVE" };

// Hot Work on a PSV: q-hot-work-01..08 (5 core questions + 3 specific; 06 gas testing needs evidence).
const setup = (overrides: Partial<AssessmentSetupValues> = {}): AssessmentSetupValues => ({
  kind: "START_WORK",
  moduleId: "mod-hot-work",
  vesselId: "ves-lady-perpetual",
  locationId: "loc-bonny",
  auditTypeId: "at-start-work-check",
  taskDescription: "  Weld new bracket on the aft deck  ",
  teamSize: 4,
  ...overrides,
});

async function answerAll(assessment: Assessment, answers: Partial<Record<number, Answer>>) {
  const form = await loadAssessmentForm(crew, assessment.id);
  const questions = form.sections.flatMap((s) => s.questions);
  for (const [index, question] of questions.entries()) {
    await saveAnswer(crew, {
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

describe("Start Work Check setup", () => {
  it("stores the task description (trimmed) and team size", async () => {
    const check = await startAssessment(crew, setup());
    expect(check.startWork).toEqual({ taskDescription: "Weld new bracket on the aft deck", teamSize: 4 });
    expect(check.auditTypeId).toBe("at-start-work-check");
  });

  it("requires a task description and a team size of 1–99", async () => {
    const fieldError = (field: string) => ({ name: "ValidationError", fieldErrors: { [field]: expect.any(String) } });
    await expect(startAssessment(crew, setup({ taskDescription: " " }))).rejects.toMatchObject(fieldError("taskDescription"));
    await expect(startAssessment(crew, setup({ taskDescription: "x".repeat(201) }))).rejects.toMatchObject(
      fieldError("taskDescription"),
    );
    await expect(startAssessment(crew, setup({ teamSize: undefined }))).rejects.toMatchObject(fieldError("teamSize"));
    await expect(startAssessment(crew, setup({ teamSize: 0 }))).rejects.toMatchObject(fieldError("teamSize"));
    await expect(startAssessment(crew, setup({ teamSize: 2.5 }))).rejects.toMatchObject(fieldError("teamSize"));
    await expect(startAssessment(crew, setup({ teamSize: 100 }))).rejects.toMatchObject(fieldError("teamSize"));
  });

  it("ignores the Start Work fields for other assessments", async () => {
    const moduleCheck = await startAssessment(
      crew,
      setup({ kind: "MODULE", moduleId: "mod-security", auditTypeId: "at-self-assessment", taskDescription: "", teamSize: undefined }),
    );
    expect(moduleCheck.startWork).toBeNull();
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
    const check = await startAssessment(crew, setup());
    await expect(
      saveAnswer(crew, { assessmentId: check.id, questionId: "q-hot-work-01", answer: "CONCERN", comment: "", observationTag: null }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("lists the No items (Non-Compliant) that stop the job", async () => {
    const check = await startAssessment(crew, setup());
    await answerAll(check, { 2: "NO", 3: "NA", 8: "NO" });
    const form = await loadAssessmentForm(crew, check.id);
    expect(stopWorkItems(form.sections, form.responses).map((q) => q.id)).toEqual(["q-hot-work-02", "q-hot-work-08"]);
  });
});

describe("submitting a Start Work Check", () => {
  it("is scored like any module and stored as a normal Start Work Check assessment", async () => {
    const check = await startAssessment(crew, setup());
    // Weights: core 01 w1, 02 w2, 03 w1, 04 w2, 05 w2, 06 w2, 07 w2, 08 w2 = 14; NO on 08 (w2) → 12/14 = 86%
    await answerAll(check, { 8: "NO" });
    // q-hot-work-08 is a critical control: a High-risk finding is required.
    await addFindingDraft(crew, check.id, "q-hot-work-08", {
      description: "No hot work permit",
      risk: "HIGH",
      ownerId: crew.id,
      targetDate: defaultTargetDate("HIGH"),
    });
    const submitted = await submitAssessment(crew, check.id);
    expect(submitted).toMatchObject({ status: "SUBMITTED", kind: "START_WORK", overallScore: 86 });

    const forDashboard = await repo.assessments.listSubmitted({ auditTypeIds: ["at-start-work-check"] });
    expect(forDashboard.map((a) => a.id)).toEqual([check.id]);
    expect(forDashboard[0].startWork).toEqual({ taskDescription: "Weld new bracket on the aft deck", teamSize: 4 });
  });
});
