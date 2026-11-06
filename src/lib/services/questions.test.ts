import { beforeEach, describe, expect, it } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import type { Principal } from "@/lib/services/permissions";
import {
  deleteQuestion,
  getQuestionsFor,
  moveQuestion,
  saveQuestion,
  setQuestionActive,
  type QuestionFormValues,
} from "@/lib/services/questions";

const admin: Principal = { id: "usr-admin", role: "ADMIN", status: "ACTIVE" };
const worker: Principal = { id: "usr-wkr-ibrahim", role: "WORKER", status: "ACTIVE" };

const form = (overrides: Partial<QuestionFormValues> = {}): QuestionFormValues => ({
  moduleId: "mod-security",
  text: "I have checked the gangway watch is in place.",
  riskCategoryId: "rc-security",
  weight: 1,
  criticalControl: false,
  evidenceRequired: false,
  vesselTypeIds: [],
  auditTypeIds: [],
  active: true,
  ...overrides,
});

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("getQuestionsFor", () => {
  it("returns active, applicable questions in display order", async () => {
    await setQuestionActive(admin, "q-security-02", false);
    await saveQuestion(admin, null, form({ text: "I have seen the MFE checklist.", auditTypeIds: ["at-mfe"] }));
    await saveQuestion(admin, null, form({ text: "I have checked the AHTS tow gear is secured.", vesselTypeIds: ["vt-ahts"] }));

    const selfOnPsv = await getQuestionsFor({ moduleId: "mod-security", vesselTypeId: "vt-psv", auditTypeId: "at-self-assessment" });
    expect(selfOnPsv.map((q) => q.id)).toEqual(["q-security-01", "q-security-03", "q-security-04", "q-security-05"]);

    const mfeOnAhts = await getQuestionsFor({ moduleId: "mod-security", vesselTypeId: "vt-ahts", auditTypeId: "at-mfe" });
    expect(mfeOnAhts).toHaveLength(6);
    expect(mfeOnAhts.map((q) => q.displayOrder)).toEqual([...mfeOnAhts.map((q) => q.displayOrder)].sort((a, b) => a - b));
  });
});

describe("saveQuestion", () => {
  it("adds a question at the end of its module", async () => {
    const created = await saveQuestion(admin, null, form({ weight: 4, criticalControl: true }));
    expect(created).toMatchObject({ moduleId: "mod-security", displayOrder: 6, weight: 4, criticalControl: true });
  });

  it("validates weight, text, references and duplicates", async () => {
    const invalid = (field: string) => ({ name: "ValidationError", fieldErrors: { [field]: expect.any(String) } });
    await expect(saveQuestion(admin, null, form({ weight: 6 }))).rejects.toMatchObject(invalid("weight"));
    await expect(saveQuestion(admin, null, form({ weight: 2.5 }))).rejects.toMatchObject(invalid("weight"));
    await expect(saveQuestion(admin, null, form({ text: "Hi" }))).rejects.toMatchObject(invalid("text"));
    await expect(saveQuestion(admin, null, form({ riskCategoryId: "rc-nope" }))).rejects.toMatchObject(invalid("riskCategoryId"));
    await expect(saveQuestion(admin, null, form({ vesselTypeIds: ["vt-nope"] }))).rejects.toMatchObject(invalid("vesselTypeIds"));
    await expect(
      saveQuestion(admin, null, form({ text: "  i have checked ACCESS CONTROL to the vessel is working. " })),
    ).rejects.toMatchObject(invalid("text"));
  });

  it("moves an edited question to the end of a new module", async () => {
    const edited = await saveQuestion(admin, "q-security-01", form({ moduleId: "mod-galley", riskCategoryId: "rc-health" }));
    expect(edited).toMatchObject({ moduleId: "mod-galley", displayOrder: 5 });
  });

  it("is admin-only", async () => {
    await expect(saveQuestion(worker, null, form())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("reorder", () => {
  it("moves a question within its module only", async () => {
    await moveQuestion(admin, "q-security-03", "up");
    const ids = (await repo.questions.list({ moduleId: "mod-security" })).map((q) => q.id);
    expect(ids.slice(0, 3)).toEqual(["q-security-01", "q-security-03", "q-security-02"]);
    expect((await repo.questions.get("q-galley-01"))?.displayOrder).toBe(1);
  });
});

describe("delete", () => {
  it("deletes a never-answered question", async () => {
    await deleteQuestion(admin, "q-security-05");
    expect(await repo.questions.get("q-security-05")).toBeNull();
  });

  it("refuses to delete an answered question, which can still be deactivated", async () => {
    const draft = await repo.assessments.create({
      kind: "MODULE",
      moduleIds: ["mod-security"],
      userId: "usr-wkr-ibrahim",
      vesselId: "ves-fds",
      locationId: "loc-bonga",
      auditTypeId: "at-self-assessment",
    });
    await repo.responses.upsert({
      assessmentId: draft.id,
      questionId: "q-security-01",
      answer: "YES",
      comment: "",
      observationTag: null,
      photoIds: [],
    });

    await expect(deleteQuestion(admin, "q-security-01")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(repo.questions.remove("q-security-01")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await setQuestionActive(admin, "q-security-01", false)).toMatchObject({ active: false });
    expect(await repo.questions.listAnsweredIds()).toEqual(["q-security-01"]);
  });
});
