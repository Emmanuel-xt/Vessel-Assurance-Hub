import { beforeEach, describe, expect, it } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import { loadAssessmentForm, saveAnswer, startAssessment, submitAssessment } from "@/lib/services/assessments";
import {
  addDays,
  addFindingDraft,
  defaultTargetDate,
  findingsRequired,
  listAssessmentFindings,
  listAssignableUsers,
  listFindingDrafts,
  noAnswersWithoutFinding,
  removeFindingDraft,
  updateFindingDraft,
  type FindingDraftValues,
} from "@/lib/services/findings";
import type { Principal } from "@/lib/services/permissions";
import { referenceYear } from "@/lib/services/references";
import type { Answer, Assessment } from "@/lib/types";

const YEAR = referenceYear(new Date());
const owner: Principal = { id: "usr-wkr-blessing", role: "WORKER", status: "ACTIVE" };
const other: Principal = { id: "usr-wkr-emeka", role: "WORKER", status: "ACTIVE" };

// Security on a PSV: q-security-01..05. 01 and 04 are critical controls; 02 needs evidence for No/Concern.
async function securityDraft(): Promise<Assessment> {
  return startAssessment(owner, {
    kind: "MODULE",
    moduleId: "mod-security",
    vesselId: "ves-lady-perpetual",
    locationId: "loc-bonny",
    auditTypeId: "at-self-assessment",
  });
}

async function answer(assessment: Assessment, answers: Answer[]) {
  const ids = ["q-security-01", "q-security-02", "q-security-03", "q-security-04", "q-security-05"];
  for (const [index, questionId] of ids.entries()) {
    await saveAnswer(owner, {
      assessmentId: assessment.id,
      questionId,
      answer: answers[index] ?? "YES",
      comment: "",
      observationTag: null,
    });
  }
}

const values = (overrides: Partial<FindingDraftValues> = {}): FindingDraftValues => ({
  description: "Access control not maintained at the gangway",
  risk: "MEDIUM",
  ownerId: "usr-sup-tunde",
  targetDate: defaultTargetDate("MEDIUM"),
  ...overrides,
});

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("target dates", () => {
  it("adds calendar days across month and year ends", () => {
    expect(addDays("2026-11-05", 7)).toBe("2026-11-12");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2028-02-25", 5)).toBe("2028-03-01"); // leap year
  });

  it("defaults to High +7, Medium +14, Low +30 days from today in Lagos", () => {
    // 23:30 UTC on 5 Nov is already 6 Nov in Lagos (UTC+1).
    const now = new Date("2026-11-05T23:30:00Z");
    expect(defaultTargetDate("HIGH", now)).toBe("2026-11-13");
    expect(defaultTargetDate("MEDIUM", now)).toBe("2026-11-20");
    expect(defaultTargetDate("LOW", now)).toBe("2026-12-06");
  });
});

describe("owners", () => {
  it("lists active users only, without private fields", async () => {
    const list = await listAssignableUsers(owner);
    expect(list.map((u) => u.id)).not.toContain("usr-pending-samuel");
    expect(list.map((u) => u.id)).not.toContain("usr-disabled-kunle");
    expect(list).toHaveLength(17); // 19 users minus 1 pending and 1 disabled
    expect(Object.keys(list[0]).sort()).toEqual(["company", "id", "name", "position"]);
  });
});

describe("preparing findings on a draft", () => {
  it("adds, edits and removes a finding for a question and a general one", async () => {
    const draft = await securityDraft();
    const linked = await addFindingDraft(owner, draft.id, "q-security-03", values({ description: "  Gangway unmanned  " }));
    expect(linked).toMatchObject({ questionId: "q-security-03", description: "Gangway unmanned", risk: "MEDIUM" });
    const general = await addFindingDraft(owner, draft.id, null, values({ risk: "LOW", targetDate: defaultTargetDate("LOW") }));
    expect(general.questionId).toBeNull();

    await updateFindingDraft(owner, linked.id, values({ risk: "HIGH", targetDate: defaultTargetDate("HIGH") }));
    expect((await listFindingDrafts(owner, draft.id)).map((d) => d.risk)).toEqual(["HIGH", "LOW"]);

    await removeFindingDraft(owner, general.id);
    expect(await listFindingDrafts(owner, draft.id)).toHaveLength(1);
  });

  it("allows one finding per question", async () => {
    const draft = await securityDraft();
    await addFindingDraft(owner, draft.id, "q-security-03", values());
    await expect(addFindingDraft(owner, draft.id, "q-security-03", values())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("validates the description, owner, target date and question", async () => {
    const draft = await securityDraft();
    const fieldError = (field: string) => ({ name: "ValidationError", fieldErrors: { [field]: expect.any(String) } });
    await expect(addFindingDraft(owner, draft.id, null, values({ description: "bad" }))).rejects.toMatchObject(
      fieldError("description"),
    );
    await expect(addFindingDraft(owner, draft.id, null, values({ ownerId: "usr-disabled-kunle" }))).rejects.toMatchObject(
      fieldError("ownerId"),
    );
    await expect(addFindingDraft(owner, draft.id, null, values({ ownerId: "usr-pending-samuel" }))).rejects.toMatchObject(
      fieldError("ownerId"),
    );
    await expect(addFindingDraft(owner, draft.id, null, values({ targetDate: "2020-01-01" }))).rejects.toMatchObject(
      fieldError("targetDate"),
    );
    await expect(addFindingDraft(owner, draft.id, "q-galley-01", values())).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("only lets the draft's owner prepare findings", async () => {
    const draft = await securityDraft();
    await expect(addFindingDraft(other, draft.id, null, values())).rejects.toMatchObject({ code: "NOT_FOUND" });
    const mine = await addFindingDraft(owner, draft.id, null, values());
    await expect(removeFindingDraft(other, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is deleted with the draft assessment", async () => {
    const draft = await securityDraft();
    await addFindingDraft(owner, draft.id, null, values());
    await repo.assessments.removeDraft(draft.id);
    expect(await repo.findingDrafts.listByAssessment(draft.id)).toEqual([]);
  });
});

describe("No answers and findings", () => {
  it("requires a High-risk finding for a critical control answered No", async () => {
    const draft = await securityDraft();
    await answer(draft, ["NO", "YES", "NO"]);
    const form = await loadAssessmentForm(owner, draft.id);
    const ids = (list: { id: string }[]) => list.map((q) => q.id);

    expect(ids(findingsRequired(form.sections, form.responses, []))).toEqual(["q-security-01"]);
    expect(ids(noAnswersWithoutFinding(form.sections, form.responses, []))).toEqual(["q-security-03"]);

    // A Medium finding does not satisfy a critical control; a High one does.
    const medium = [{ questionId: "q-security-01", risk: "MEDIUM" as const }];
    expect(ids(findingsRequired(form.sections, form.responses, medium))).toEqual(["q-security-01"]);
    const high = [{ questionId: "q-security-01", risk: "HIGH" as const }];
    expect(findingsRequired(form.sections, form.responses, high)).toEqual([]);
  });

  it("blocks submit until the critical finding exists, but lets a non-critical No through", async () => {
    const draft = await securityDraft();
    await answer(draft, ["NO", "YES", "NO"]);
    await expect(submitAssessment(owner, draft.id)).rejects.toMatchObject({
      name: "ValidationError",
      message: "1 critical control answered No needs a High-risk finding before you can submit.",
    });

    await addFindingDraft(owner, draft.id, "q-security-01", values({ risk: "HIGH", targetDate: defaultTargetDate("HIGH") }));
    expect(await submitAssessment(owner, draft.id)).toMatchObject({ status: "SUBMITTED" });
  });

  it("blocks submit if a prepared finding's owner is no longer active", async () => {
    const draft = await securityDraft();
    await answer(draft, []);
    await addFindingDraft(owner, draft.id, null, values());
    await repo.users.update("usr-sup-tunde", { status: "DISABLED" });
    await expect(submitAssessment(owner, draft.id)).rejects.toMatchObject({ name: "ValidationError" });
    expect((await repo.assessments.get(draft.id))?.status).toBe("DRAFT");
  });
});

describe("raising findings at submit", () => {
  it("creates numbered findings with action A1, activity and notifications, then clears the drafts", async () => {
    const draft = await securityDraft();
    await answer(draft, ["NO", "YES", "NO"]);
    await addFindingDraft(owner, draft.id, "q-security-01", {
      description: "Restricted areas left unlocked",
      risk: "HIGH",
      ownerId: "usr-sup-tunde",
      targetDate: defaultTargetDate("HIGH"),
    });
    await addFindingDraft(owner, draft.id, null, {
      description: "Security notice board out of date",
      risk: "LOW",
      ownerId: owner.id,
      targetDate: defaultTargetDate("LOW"),
    });
    await submitAssessment(owner, draft.id);

    const raised = await listAssessmentFindings(owner, draft.id);
    expect(raised.map((r) => r.finding.reference)).toEqual([`VAH-F-${YEAR}-0001`, `VAH-F-${YEAR}-0002`]);

    const [critical, general] = raised;
    expect(critical.finding).toMatchObject({
      risk: "HIGH",
      critical: true,
      status: "OPEN",
      moduleId: "mod-security",
      vesselId: "ves-lady-perpetual",
      raisedById: owner.id,
    });
    expect(critical.finding.responseId).not.toBeNull();
    expect(critical.actions).toEqual([
      expect.objectContaining({
        reference: `VAH-F-${YEAR}-0001-A1`,
        ownerId: "usr-sup-tunde",
        ownerName: "Tunde Bakare",
        targetDate: defaultTargetDate("HIGH"),
        description: "Restricted areas left unlocked",
        createdById: owner.id,
        status: "OPEN",
      }),
    ]);
    expect(general.finding).toMatchObject({ responseId: null, critical: false, risk: "LOW" });

    const log = await repo.findingActivities.listByFinding(critical.finding.id);
    expect(log.map((x) => x.type)).toEqual(["RAISED", "ACTION_ADDED"]);
    expect(log.every((x) => x.userId === owner.id)).toBe(true);

    // High risk → admins; owner told about the action; nobody notified of their own entry.
    const adminNotes = await repo.notifications.listForUser("usr-admin");
    expect(adminNotes).toEqual([expect.objectContaining({ type: "HIGH_RISK_FINDING", link: `/findings/${critical.finding.id}` })]);
    const ownerNotes = await repo.notifications.listForUser("usr-sup-tunde");
    expect(ownerNotes).toEqual([
      expect.objectContaining({ type: "ACTION_ASSIGNED", title: `High-risk action VAH-F-${YEAR}-0001-A1 assigned to you` }),
    ]);
    expect(await repo.notifications.listForUser(owner.id)).toEqual([]);

    expect(await repo.findingDrafts.listByAssessment(draft.id)).toEqual([]);
  });

  it("keeps a finding whose answer was changed away from No", async () => {
    const draft = await securityDraft();
    await answer(draft, ["YES", "YES", "NO"]);
    await addFindingDraft(owner, draft.id, "q-security-03", values());
    await answer(draft, []); // all Yes now
    await submitAssessment(owner, draft.id);
    expect(await listAssessmentFindings(owner, draft.id)).toHaveLength(1);
  });
});
