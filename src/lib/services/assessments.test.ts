import { beforeEach, describe, expect, it } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import {
  countApplicableQuestions,
  getAssessmentForUser,
  listMyAssessments,
  listMyOpenActions,
  startAssessment,
  type AssessmentSetupValues,
} from "@/lib/services/assessments";
import { allowedAuditTypesFor, canEditAssessment, canViewAssessment, type Principal } from "@/lib/services/permissions";
import { referenceYear } from "@/lib/services/references";

const YEAR = referenceYear(new Date());
const worker: Principal = { id: "usr-wkr-blessing", role: "WORKER", status: "ACTIVE" };
const otherWorker: Principal = { id: "usr-wkr-emeka", role: "WORKER", status: "ACTIVE" };
const supervisor: Principal = { id: "usr-sup-tunde", role: "SUPERVISOR", status: "ACTIVE" };
const admin: Principal = { id: "usr-admin", role: "ADMIN", status: "ACTIVE" };

const setup = (overrides: Partial<AssessmentSetupValues> = {}): AssessmentSetupValues => ({
  kind: "MODULE",
  moduleId: "mod-security",
  vesselId: "ves-lady-perpetual",
  locationId: "loc-bonny",
  auditTypeId: "at-self-assessment",
  ...overrides,
});

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("allowedAuditTypesFor", () => {
  it("reserves the Start Work Check audit type for Start Work Checks", async () => {
    const types = await repo.auditTypes.list();
    const codes = (role: Principal["role"], kind: "MODULE" | "START_WORK") =>
      allowedAuditTypesFor(role, kind, types).map((t) => t.code);

    expect(codes("WORKER", "MODULE")).toEqual(["SELF_ASSESSMENT"]);
    expect(codes("WORKER", "START_WORK")).toEqual(["START_WORK_CHECK"]);
    expect(codes("SUPERVISOR", "MODULE")).toEqual(["SELF_ASSESSMENT", "MFE", "SPOT_CHECK", "VERIFICATION"]);
    expect(codes("SUPERVISOR", "START_WORK")).toEqual(["START_WORK_CHECK"]);
  });
});

describe("startAssessment", () => {
  it("creates a draft with a reference number and snapshot", async () => {
    const draft = await startAssessment(worker, setup());
    expect(draft).toMatchObject({
      reference: `VAH-A-${YEAR}-0001`,
      status: "DRAFT",
      kind: "MODULE",
      moduleIds: ["mod-security"],
      userId: "usr-wkr-blessing",
      locationId: "loc-bonny",
      snapshot: { userName: "Blessing Okon", company: "Coastway Marine", position: "Bridge Officer", vesselName: "Lady Perpetual", packageId: "pkg-epc2" },
    });
    expect((await startAssessment(worker, setup())).reference).toBe(`VAH-A-${YEAR}-0002`);
  });

  it("covers every active assurance module for Full Vessel Assurance", async () => {
    await repo.modules.update("mod-galley", { active: false });
    const draft = await startAssessment(supervisor, setup({ kind: "FULL_VESSEL", moduleId: "", auditTypeId: "at-mfe" }));
    expect(draft.kind).toBe("FULL_VESSEL");
    expect(draft.moduleIds).toHaveLength(11);
    expect(draft.moduleIds).not.toContain("mod-galley");
    expect(draft.moduleIds).not.toContain("mod-hot-work");
  });

  it("starts a Start Work Check for a Start Work module with its own audit type only", async () => {
    const swc = await startAssessment(
      worker,
      setup({
        kind: "START_WORK",
        moduleId: "mod-hot-work",
        auditTypeId: "at-start-work-check",
        taskDescription: "Weld bracket on deck",
        teamSize: 3,
      }),
    );
    expect(swc).toMatchObject({ kind: "START_WORK", moduleIds: ["mod-hot-work"] });

    await expect(
      startAssessment(
        worker,
        setup({
          kind: "START_WORK",
          moduleId: "mod-hot-work",
          auditTypeId: "at-self-assessment",
          taskDescription: "Weld bracket on deck",
          teamSize: 3,
        }),
      ),
    ).rejects.toMatchObject({ name: "PermissionError", code: "FORBIDDEN" });
    await expect(startAssessment(worker, setup({ auditTypeId: "at-start-work-check" }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("enforces the role's audit types even if the UI is bypassed", async () => {
    await expect(startAssessment(worker, setup({ auditTypeId: "at-mfe" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await startAssessment(supervisor, setup({ auditTypeId: "at-mfe" }))).toMatchObject({ status: "DRAFT" });
  });

  it("rejects inactive or wrong-category choices", async () => {
    const invalid = (field: string) => ({ name: "ValidationError", fieldErrors: { [field]: expect.any(String) } });
    await repo.vessels.update("ves-fds", { status: "INACTIVE" });
    await repo.locations.update("loc-ea", { active: false });

    await expect(startAssessment(worker, setup({ vesselId: "ves-fds" }))).rejects.toMatchObject(invalid("vesselId"));
    await expect(startAssessment(worker, setup({ locationId: "loc-ea" }))).rejects.toMatchObject(invalid("locationId"));
    await expect(startAssessment(worker, setup({ moduleId: "mod-hot-work" }))).rejects.toMatchObject(invalid("moduleId"));
    await expect(startAssessment(worker, setup({ vesselId: "" }))).rejects.toMatchObject(invalid("vesselId"));
  });

  it("refuses signed-out or disabled users", async () => {
    await expect(startAssessment({ ...worker, status: "DISABLED" }, setup())).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});

describe("access to assessments", () => {
  it("lets owners and admins open drafts, supervisors only submitted ones", async () => {
    const draft = await startAssessment(worker, setup());
    expect(await getAssessmentForUser(worker, draft.id)).toMatchObject({ id: draft.id });
    expect(await getAssessmentForUser(admin, draft.id)).toMatchObject({ id: draft.id });
    await expect(getAssessmentForUser(otherWorker, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getAssessmentForUser(supervisor, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const submitted = { userId: worker.id, status: "SUBMITTED" as const };
    expect(canViewAssessment(supervisor, submitted)).toBe(true);
    expect(canViewAssessment(otherWorker, submitted)).toBe(false);
  });

  it("only lets the owner edit a draft", () => {
    expect(canEditAssessment(worker, { userId: worker.id, status: "DRAFT" })).toBe(true);
    expect(canEditAssessment(admin, { userId: worker.id, status: "DRAFT" })).toBe(false);
    expect(canEditAssessment(worker, { userId: worker.id, status: "SUBMITTED" })).toBe(false);
  });
});

describe("my lists", () => {
  it("lists only my assessments, drafts first", async () => {
    const first = await startAssessment(worker, setup());
    await repo.assessments.submit(first.id, { overallScore: null, moduleScores: {} });
    const second = await startAssessment(worker, setup());
    await startAssessment(otherWorker, setup());

    expect((await listMyAssessments(worker)).map((a) => a.id)).toEqual([second.id, first.id]);
  });

  it("counts open and in-progress actions assigned to me", async () => {
    const assessment = await startAssessment(worker, setup());
    await repo.assessments.submit(assessment.id, { overallScore: null, moduleScores: {} });
    const finding = await repo.findings.create({
      assessmentId: assessment.id,
      responseId: null,
      description: "Gangway unattended",
      risk: "HIGH",
      critical: true,
      raisedById: worker.id,
    });
    const base = { findingId: finding.id, createdById: worker.id, targetDate: "2026-12-01" };
    await repo.actions.create({ ...base, description: "A", ownerId: worker.id });
    const b = await repo.actions.create({ ...base, description: "B", ownerId: worker.id });
    const c = await repo.actions.create({ ...base, description: "C", ownerId: worker.id });
    await repo.actions.update(b.id, { status: "IN_PROGRESS" });
    await repo.actions.update(c.id, { status: "CLOSED" });
    await repo.actions.create({ ...base, description: "D", ownerId: otherWorker.id });

    expect((await listMyOpenActions(worker)).map((a) => a.description).sort()).toEqual(["A", "B"]);
  });
});

describe("countApplicableQuestions", () => {
  it("counts questions per module for the vessel type and audit type", async () => {
    expect(
      await countApplicableQuestions({
        moduleIds: ["mod-security", "mod-navigation-watch"],
        vesselTypeId: "vt-cargo-barge",
        auditTypeId: "at-self-assessment",
      }),
    ).toEqual({ "mod-security": 5, "mod-navigation-watch": 0 });
  });
});
