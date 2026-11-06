import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import {
  deleteMyDraft,
  lagosDayEnd,
  lagosDayStart,
  listAllAssessmentRows,
  listMyAssessmentRows,
  loadAssessmentDetail,
  loadFilterOptions,
} from "@/lib/services/assessment-lists";
import {
  loadAssessmentForm,
  saveAnswer,
  startAssessment,
  submitAssessment,
  type AssessmentSetupValues,
} from "@/lib/services/assessments";
import { addFindingDraft, defaultTargetDate } from "@/lib/services/findings";
import type { Principal } from "@/lib/services/permissions";
import type { Answer, Assessment } from "@/lib/types";

const blessing: Principal = { id: "usr-wkr-blessing", role: "WORKER", status: "ACTIVE" };
const emeka: Principal = { id: "usr-wkr-emeka", role: "WORKER", status: "ACTIVE" };
const supervisor: Principal = { id: "usr-sup-tunde", role: "SUPERVISOR", status: "ACTIVE" };
const admin: Principal = { id: "usr-admin", role: "ADMIN", status: "ACTIVE" };

const security = (overrides: Partial<AssessmentSetupValues> = {}): AssessmentSetupValues => ({
  kind: "MODULE",
  moduleId: "mod-security",
  vesselId: "ves-lady-perpetual",
  locationId: "loc-bonny",
  auditTypeId: "at-self-assessment",
  ...overrides,
});

/** Starts, answers (all Yes unless given) and submits a Security assessment. */
async function submitted(actor: Principal, overrides: Partial<AssessmentSetupValues> = {}, answers: Answer[] = []) {
  const draft = await startAssessment(actor, security(overrides));
  const form = await loadAssessmentForm(actor, draft.id);
  for (const [index, question] of form.sections.flatMap((s) => s.questions).entries()) {
    await saveAnswer(actor, {
      assessmentId: draft.id,
      questionId: question.id,
      answer: answers[index] ?? "YES",
      comment: index === 0 ? "Checked at the gangway" : "",
      observationTag: index === 1 ? "GOOD_PRACTICE" : null,
    });
  }
  return submitAssessment(actor, draft.id);
}

/** Submits at a fixed moment, so date filters can be tested. */
async function submittedAt(iso: string, actor: Principal, overrides: Partial<AssessmentSetupValues> = {}) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
  try {
    return await submitted(actor, overrides);
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

afterEach(() => vi.useRealTimers());

describe("My assessments", () => {
  it("splits drafts and submitted, with names for display", async () => {
    const first = await submitted(blessing);
    const draft = await startAssessment(blessing, security({ moduleId: "mod-galley" }));
    const second = await submitted(blessing, { vesselId: "ves-fds", locationId: "loc-ea" });
    await submitted(emeka); // someone else's

    const mine = await listMyAssessmentRows(blessing);
    expect(mine.drafts.map((r) => r.assessment.id)).toEqual([draft.id]);
    expect(mine.drafts[0]).toMatchObject({ title: "Galley", auditTypeName: "Self Assessment", locationName: "Bonny" });
    expect(mine.submitted.map((r) => r.assessment.id)).toEqual([second.id, first.id]);
    expect(mine.submitted[0]).toMatchObject({ title: "Security", locationName: "EA", openFindings: 0 });
  });

  it("deletes only the actor's own drafts", async () => {
    const draft = await startAssessment(blessing, security());
    await expect(deleteMyDraft(emeka, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteMyDraft(admin, draft.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteMyDraft(blessing, draft.id);
    expect(await repo.assessments.get(draft.id)).toBeNull();

    const done = await submitted(blessing);
    await expect(deleteMyDraft(blessing, done.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("All assessments", () => {
  it("is for supervisors and admins only", async () => {
    await expect(listAllAssessmentRows(blessing)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(loadFilterOptions(blessing)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await listAllAssessmentRows(supervisor)).toEqual([]);
  });

  it("lists submitted assessments only, newest first, and filters them", async () => {
    const a = await submitted(blessing);
    const b = await submitted(emeka, { vesselId: "ves-fds", locationId: "loc-ea" });
    const c = await submitted(supervisor, { moduleId: "mod-galley", auditTypeId: "at-mfe" });
    await startAssessment(blessing, security()); // draft: never listed

    const ids = (rows: { assessment: Assessment }[]) => rows.map((r) => r.assessment.id);
    expect(ids(await listAllAssessmentRows(admin))).toEqual([c.id, b.id, a.id]);
    expect(ids(await listAllAssessmentRows(admin, { vesselId: "ves-fds" }))).toEqual([b.id]);
    expect(ids(await listAllAssessmentRows(admin, { locationId: "loc-bonny" }))).toEqual([c.id, a.id]);
    expect(ids(await listAllAssessmentRows(admin, { moduleId: "mod-galley" }))).toEqual([c.id]);
    expect(ids(await listAllAssessmentRows(admin, { auditTypeId: "at-self-assessment" }))).toEqual([b.id, a.id]);
    expect(ids(await listAllAssessmentRows(supervisor, { userId: "usr-wkr-emeka" }))).toEqual([b.id]);
  });

  it("filters by package, contractor, self/supervisory and a question answered No", async () => {
    const a = await submitted(blessing, {}, ["YES", "YES", "NO"]); // Coastway Marine, EPC2, self
    const b = await submitted(supervisor, { auditTypeId: "at-mfe", vesselId: "ves-blue-gretha" }); // EPC1, supervisory
    const ids = (rows: { assessment: Assessment }[]) => rows.map((r) => r.assessment.id);

    expect(ids(await listAllAssessmentRows(admin, { packageId: "pkg-epc1" }))).toEqual([b.id]);
    expect(ids(await listAllAssessmentRows(admin, { company: "Coastway Marine" }))).toEqual([a.id]);
    expect(ids(await listAllAssessmentRows(admin, { scope: "self" }))).toEqual([a.id]);
    expect(ids(await listAllAssessmentRows(admin, { scope: "supervisory" }))).toEqual([b.id]);
    expect(ids(await listAllAssessmentRows(admin, { scope: "supervisory", auditTypeId: "at-self-assessment" }))).toEqual([]);
    expect(ids(await listAllAssessmentRows(admin, { questionId: "q-security-03" }))).toEqual([a.id]);
    expect(ids(await listAllAssessmentRows(admin, { questionId: "q-security-01" }))).toEqual([]);
  });

  it("filters by Lagos calendar dates, inclusive", async () => {
    // 23:30 UTC on 1 Nov is 00:30 on 2 Nov in Lagos.
    const lateNight = await submittedAt("2026-11-01T23:30:00Z", blessing);
    const nov3 = await submittedAt("2026-11-03T10:00:00Z", blessing);
    const ids = (rows: { assessment: Assessment }[]) => rows.map((r) => r.assessment.id);

    expect(ids(await listAllAssessmentRows(admin, { from: "2026-11-02", to: "2026-11-02" }))).toEqual([lateNight.id]);
    expect(ids(await listAllAssessmentRows(admin, { from: "2026-11-03" }))).toEqual([nov3.id]);
    expect(ids(await listAllAssessmentRows(admin, { to: "2026-11-01" }))).toEqual([]);
    await expect(listAllAssessmentRows(admin, { from: "2026-11-05", to: "2026-11-01" })).rejects.toMatchObject({
      fieldErrors: { to: expect.any(String) },
    });
  });

  it("converts Lagos days to UTC timestamps", () => {
    expect(lagosDayStart("2026-11-02")).toBe("2026-11-01T23:00:00.000Z");
    expect(lagosDayEnd("2026-11-02")).toBe("2026-11-02T22:59:59.999Z");
  });

  it("offers filter choices by name, without pending sign-ups", async () => {
    const options = await loadFilterOptions(admin);
    expect(options.vessels).toHaveLength(41);
    expect(options.modules[0].name).toBe("Marine Start Work");
    expect(options.users.map((u) => u.id)).not.toContain("usr-pending-samuel");
    expect(options.users.map((u) => u.id)).toContain("usr-disabled-kunle");
  });
});

describe("assessment detail", () => {
  it("shows the answers as they were submitted, even after the question bank changes", async () => {
    const done = await submitted(blessing, {}, ["YES", "YES", "NO"]);
    await repo.questions.update("q-security-03", { text: "Reworded later", active: false });

    const detail = await loadAssessmentDetail(supervisor, done.id);
    expect(detail).toMatchObject({ title: "Security", locationName: "Bonny", packageName: "EPC2", editable: false });
    const items = detail.sections[0].items;
    expect(items.map((i) => i.number)).toEqual([1, 2, 3, 4, 5]);
    expect(items[2].text).not.toBe("Reworded later");
    expect(items[2].response?.answer).toBe("NO");
    expect(items[0].response?.comment).toBe("Checked at the gangway");
    expect(detail.positiveInterventionCount).toBe(1);
  });

  it("includes findings with their actions and current status", async () => {
    const draft = await startAssessment(blessing, security());
    const form = await loadAssessmentForm(blessing, draft.id);
    for (const q of form.sections[0].questions) {
      await saveAnswer(blessing, { assessmentId: draft.id, questionId: q.id, answer: "YES", comment: "", observationTag: null });
    }
    await addFindingDraft(blessing, draft.id, null, {
      description: "Notice board out of date",
      risk: "LOW",
      ownerId: "usr-sup-tunde",
      targetDate: defaultTargetDate("LOW"),
    });
    await submitAssessment(blessing, draft.id);
    const [raised] = await repo.findings.list({ assessmentId: draft.id });
    await repo.findings.update(raised.id, { status: "IN_PROGRESS" });

    const detail = await loadAssessmentDetail(blessing, draft.id);
    expect(detail.findings).toHaveLength(1);
    expect(detail.findings[0].finding.status).toBe("IN_PROGRESS");
    expect(detail.findings[0].actions[0]).toMatchObject({ ownerName: "Tunde Bakare", status: "OPEN" });
    expect((await listMyAssessmentRows(blessing)).submitted[0].openFindings).toBe(1);
  });

  it("follows the access rules", async () => {
    const draft = await startAssessment(blessing, security());
    expect((await loadAssessmentDetail(blessing, draft.id)).editable).toBe(true);
    expect((await loadAssessmentDetail(admin, draft.id)).editable).toBe(false);
    await expect(loadAssessmentDetail(supervisor, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(loadAssessmentDetail(emeka, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
