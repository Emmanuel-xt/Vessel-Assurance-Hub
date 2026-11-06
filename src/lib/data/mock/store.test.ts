import { beforeEach, describe, expect, it } from "vitest";
import { RepositoryError } from "@/lib/data/repositories";
import { referenceYear } from "@/lib/services/references";
import type { Assessment } from "@/lib/types";
import { mockRepositories as repo } from "./index";
import { STORAGE_KEY } from "./schema";
import { getPhotoBlob } from "./photo-store";
import { forgetMemoryState } from "./store";
import { setMockDelay } from "./utils";

const YEAR = referenceYear(new Date());

/** Simulates a full page reload: the in-memory copy is dropped and reloaded from localStorage. */
const reload = () => forgetMemoryState();

const rejectsWith = (promise: Promise<unknown>, code: RepositoryError["code"]) =>
  expect(promise).rejects.toMatchObject({ name: "RepositoryError", code });

async function draftAssessment(overrides: Partial<Parameters<typeof repo.assessments.create>[0]> = {}) {
  return repo.assessments.create({
    kind: "MODULE",
    moduleIds: ["mod-security"],
    userId: "usr-wkr-blessing",
    vesselId: "ves-lady-perpetual",
    locationId: "loc-bonga",
    auditTypeId: "at-self-assessment",
    ...overrides,
  });
}

async function submittedAssessment(): Promise<Assessment> {
  const draft = await draftAssessment();
  await repo.responses.upsert({
    assessmentId: draft.id,
    questionId: "q-security-01",
    answer: "NO",
    comment: "Gangway unattended",
    observationTag: null,
    photoIds: [],
  });
  return repo.assessments.submit(draft.id, { overallScore: 0, moduleScores: { "mod-security": 0 } });
}

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  reload();
  await repo.demo.reset();
});

describe("seeding", () => {
  it("seeds the fixtures on first use and saves them under the versioned key", async () => {
    localStorage.clear();
    reload();

    expect(await repo.vessels.list()).toHaveLength(41);
    expect(await repo.modules.list()).toHaveLength(17);
    expect(await repo.users.list()).toHaveLength(19);
    expect(await repo.users.list({ status: "DISABLED" })).toHaveLength(1);
    expect(await repo.users.list({ status: "PENDING" })).toHaveLength(1);
    expect(await repo.locations.list()).toHaveLength(4);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("gives every module at least 4 active questions", async () => {
    const [modules, questions] = await Promise.all([repo.modules.list(), repo.questions.list({ activeOnly: true })]);
    for (const m of modules) {
      expect(questions.filter((q) => q.moduleId === m.id).length, m.name).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("create", () => {
  it("creates a user as PENDING with a generated id", async () => {
    const user = await repo.users.create({
      name: "New Starter",
      email: "new.starter@example.com",
      password: "secret123",
      company: "Coastway Marine",
      position: "Crew Member",
      role: "WORKER",
    });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.status).toBe("PENDING");
    expect(await repo.users.findByEmail("NEW.STARTER@example.com")).toMatchObject({ id: user.id });
  });

  it("rejects a duplicate email", async () => {
    await rejectsWith(
      repo.users.create({
        name: "Copy",
        email: "Admin@Example.com",
        password: "x",
        company: "x",
        position: "x",
        role: "WORKER",
      }),
      "CONFLICT",
    );
  });

  it("snapshots the user and vessel on a new assessment", async () => {
    const draft = await draftAssessment();
    expect(draft).toMatchObject({
      status: "DRAFT",
      reference: `VAH-A-${YEAR}-0001`,
      snapshot: { userName: "Blessing Okon", company: "Coastway Marine", vesselName: "Lady Perpetual", packageId: "pkg-epc2" },
    });
  });
});

describe("update", () => {
  it("updates a record and leaves unspecified fields alone", async () => {
    const updated = await repo.vessels.update("ves-fds", { contractor: "Example Contractor" });
    expect(updated).toMatchObject({ contractor: "Example Contractor", name: "FDS", status: "ACTIVE" });
    expect(await repo.vessels.get("ves-fds")).toMatchObject({ contractor: "Example Contractor" });
  });

  it("returns copies, so mutating a result never changes stored data", async () => {
    const vessel = (await repo.vessels.get("ves-fds"))!;
    vessel.name = "Changed outside the repository";
    expect((await repo.vessels.get("ves-fds"))!.name).toBe("FDS");
  });

  it("rejects updates to a missing record", async () => {
    await rejectsWith(repo.vessels.update("ves-missing", { contractor: "x" }), "NOT_FOUND");
  });
});

describe("persistence", () => {
  it("keeps created and updated data after a reload", async () => {
    const location = await repo.locations.create({ name: "Escravos" });
    await repo.users.update("usr-pending-samuel", { status: "ACTIVE" });

    reload();

    expect(await repo.locations.get(location.id)).toMatchObject({ name: "Escravos", active: true });
    expect(await repo.users.get("usr-pending-samuel")).toMatchObject({ status: "ACTIVE" });
  });

  it("keeps reference counters after a reload", async () => {
    await submittedAssessment();
    reload();
    const second = await submittedAssessment();
    expect(second.reference).toBe(`VAH-A-${YEAR}-0002`);
  });

  it("reseeds when saved data is unreadable", async () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    reload();
    expect(await repo.vessels.list()).toHaveLength(41);
  });
});

describe("reset", () => {
  it("restores the fixtures, reference counters and photo storage", async () => {
    await repo.vessels.create({
      name: "Extra Vessel",
      vesselTypeId: "vt-psv",
      packageId: "pkg-epc1",
      contractor: null,
      defaultLocationId: "loc-bonny",
    });
    await repo.modules.update("mod-galley", { active: false });
    await submittedAssessment();
    const photo = await repo.photos.upload(new Blob(["jpeg-bytes"], { type: "image/jpeg" }));

    await repo.demo.reset();

    expect(await repo.vessels.list()).toHaveLength(41);
    expect(await repo.modules.get("mod-galley")).toMatchObject({ active: true });
    expect(await repo.assessments.list()).toHaveLength(0);
    expect(await repo.photos.getMeta(photo.id)).toBeNull();
    expect(await repo.photos.getUrl(photo.id)).toBeNull();
    expect((await submittedAssessment()).reference).toBe(`VAH-A-${YEAR}-0001`);
  });

  it("survives a reload after reset", async () => {
    await repo.locations.create({ name: "Temporary" });
    await repo.demo.reset();
    reload();
    expect(await repo.locations.list()).toHaveLength(4);
  });
});

describe("question applicability", () => {
  it("leaves out bridge questions for unpowered cargo barges", async () => {
    const forBarge = await repo.questions.listFor({
      moduleId: "mod-navigation-watch",
      vesselTypeId: "vt-cargo-barge",
      auditTypeId: "at-self-assessment",
    });
    const forPsv = await repo.questions.listFor({
      moduleId: "mod-navigation-watch",
      vesselTypeId: "vt-psv",
      auditTypeId: "at-self-assessment",
    });
    expect(forBarge).toHaveLength(0);
    expect(forPsv.length).toBeGreaterThan(0);
    expect(forPsv.map((q) => q.displayOrder)).toEqual([...forPsv.map((q) => q.displayOrder)].sort((a, b) => a - b));
  });

  it("hides deactivated questions but keeps them in the bank", async () => {
    await repo.questions.update("q-security-01", { active: false });
    const live = await repo.questions.listFor({ moduleId: "mod-security", vesselTypeId: "vt-psv", auditTypeId: "at-mfe" });
    expect(live.map((q) => q.id)).not.toContain("q-security-01");
    expect(await repo.questions.get("q-security-01")).not.toBeNull();
  });

  it("filters audit types by role", async () => {
    expect((await repo.auditTypes.listForRole("WORKER")).map((t) => t.code)).toEqual(["SELF_ASSESSMENT", "START_WORK_CHECK"]);
    expect(await repo.auditTypes.listForRole("SUPERVISOR")).toHaveLength(5);
  });
});

describe("assessment lifecycle", () => {
  it("stores the service's scores on submit and locks the assessment", async () => {
    const draft = await draftAssessment();
    const base = { assessmentId: draft.id, comment: "", observationTag: null, photoIds: [] };
    await repo.responses.upsert({ ...base, questionId: "q-security-01", answer: "YES" }); // critical, weight 2
    await repo.responses.upsert({ ...base, questionId: "q-security-02", answer: "CONCERN" });
    await repo.responses.upsert({ ...base, questionId: "q-security-03", answer: "NA" });
    // Upserting the same question replaces the answer rather than adding a second one.
    await repo.responses.upsert({ ...base, questionId: "q-security-02", answer: "NO" });
    expect(await repo.responses.listByAssessment(draft.id)).toHaveLength(3);

    const scores = { overallScore: 67, moduleScores: { "mod-security": 67 } };
    const submitted = await repo.assessments.submit(draft.id, scores);
    expect(submitted).toMatchObject({ status: "SUBMITTED", reference: `VAH-A-${YEAR}-0001`, ...scores });
    expect(submitted.submittedAt).not.toBeNull();

    await rejectsWith(repo.assessments.submit(draft.id, scores), "CONFLICT");
    await rejectsWith(
      repo.responses.upsert({ ...base, questionId: "q-security-01", answer: "NO" }),
      "CONFLICT",
    );
    expect(await repo.assessments.listSubmitted({ vesselIds: ["ves-lady-perpetual"] })).toHaveLength(1);
    expect(await repo.assessments.listSubmitted({ vesselIds: ["ves-fds"] })).toHaveLength(0);
  });

  it("rejects answers to questions outside the assessment's modules", async () => {
    const draft = await draftAssessment();
    await rejectsWith(
      repo.responses.upsert({
        assessmentId: draft.id,
        questionId: "q-galley-01",
        answer: "YES",
        comment: "",
        observationTag: null,
        photoIds: [],
      }),
      "VALIDATION",
    );
  });

  it("deletes a draft with its responses", async () => {
    const draft = await draftAssessment();
    await repo.responses.upsert({
      assessmentId: draft.id,
      questionId: "q-security-01",
      answer: "YES",
      comment: "",
      observationTag: null,
      photoIds: [],
    });
    await repo.assessments.removeDraft(draft.id);
    expect(await repo.assessments.get(draft.id)).toBeNull();
    expect(await repo.responses.listByAssessment(draft.id)).toHaveLength(0);
  });
});

describe("findings and actions", () => {
  it("only records findings against submitted assessments", async () => {
    const draft = await draftAssessment();
    await rejectsWith(
      repo.findings.create({
        assessmentId: draft.id,
        responseId: null,
        description: "x",
        risk: "LOW",
        critical: false,
        raisedById: "usr-wkr-blessing",
      }),
      "CONFLICT",
    );
  });

  it("numbers findings per year and actions per finding", async () => {
    const assessment = await submittedAssessment();
    const [response] = await repo.responses.listByAssessment(assessment.id);

    const finding = await repo.findings.create({
      assessmentId: assessment.id,
      responseId: response.id,
      description: "Access control not working at the gangway",
      risk: "HIGH",
      critical: true,
      raisedById: "usr-wkr-blessing",
    });
    expect(finding).toMatchObject({
      reference: `VAH-F-${YEAR}-0001`,
      status: "OPEN",
      vesselId: "ves-lady-perpetual",
      moduleId: "mod-security",
    });

    const base = { findingId: finding.id, createdById: "usr-wkr-blessing", targetDate: "2026-12-01" };
    const a1 = await repo.actions.create({ ...base, description: "Post a gangway watch", ownerId: "usr-sup-chidi" });
    const a2 = await repo.actions.create({ ...base, description: "Repair the turnstile", ownerId: "usr-wkr-emeka" });
    expect([a1.reference, a2.reference]).toEqual([`VAH-F-${YEAR}-0001-A1`, `VAH-F-${YEAR}-0001-A2`]);

    const closed = await repo.actions.update(a1.id, {
      status: "CLOSED",
      closedById: "usr-sup-chidi",
      closedAt: new Date().toISOString(),
      closureComment: "Watch posted",
    });
    expect(closed).toMatchObject({ status: "CLOSED", closedById: "usr-sup-chidi" });
    expect(await repo.actions.list({ ownerId: "usr-wkr-emeka", status: "OPEN" })).toHaveLength(1);

    await repo.findingActivities.create({
      findingId: finding.id,
      actionId: a1.id,
      userId: "usr-sup-chidi",
      type: "ACTION_CLOSED",
      note: "Watch posted",
    });
    expect(await repo.findingActivities.listByFinding(finding.id)).toHaveLength(1);
  });

  it("rejects an action owner who does not exist", async () => {
    const assessment = await submittedAssessment();
    const finding = await repo.findings.create({
      assessmentId: assessment.id,
      responseId: null,
      description: "x",
      risk: "LOW",
      critical: false,
      raisedById: "usr-admin",
    });
    await rejectsWith(
      repo.actions.create({ findingId: finding.id, description: "x", ownerId: "usr-nobody", targetDate: "2026-12-01", createdById: "usr-admin" }),
      "NOT_FOUND",
    );
  });
});

describe("positive interventions and notifications", () => {
  it("records a positive intervention with its own reference", async () => {
    const assessment = await submittedAssessment();
    const pi = await repo.positiveInterventions.create({
      assessmentId: assessment.id,
      responseId: null,
      description: "Crew stopped the job when visibility dropped",
      recordedById: "usr-wkr-blessing",
    });
    expect(pi).toMatchObject({ reference: `VAH-P-${YEAR}-0001`, moduleId: "mod-security" });
  });

  it("lists a user's notifications newest first and marks them read", async () => {
    const base = { userId: "usr-admin", type: "HIGH_RISK_FINDING" as const, body: "", link: "/findings/x" };
    await repo.notifications.create({ ...base, title: "First" });
    await new Promise((r) => setTimeout(r, 5));
    await repo.notifications.create({ ...base, title: "Second" });

    const list = await repo.notifications.listForUser("usr-admin");
    expect(list.map((n) => n.title)).toEqual(["Second", "First"]);

    await repo.notifications.markAllRead("usr-admin");
    expect(await repo.notifications.listForUser("usr-admin", { unreadOnly: true })).toHaveLength(0);
  });
});

describe("photos", () => {
  it("uploads, describes, serves and deletes a photo", async () => {
    const meta = await repo.photos.upload(new Blob(["fake image"], { type: "image/jpeg" }), { width: 1600, height: 1200 });
    expect(meta).toMatchObject({ mimeType: "image/jpeg", size: 10, width: 1600, height: 1200 });
    expect(await repo.photos.getMeta(meta.id)).toEqual(meta);

    const url = await repo.photos.getUrl(meta.id);
    expect(url).toMatch(/^blob:/);
    expect(await repo.photos.getUrl(meta.id)).toBe(url); // one object URL per photo

    const blob = await getPhotoBlob(meta.id);
    expect(blob?.type).toBe("image/jpeg");
    expect(await blob?.text()).toBe("fake image");

    await repo.photos.delete(meta.id);
    expect(await repo.photos.getMeta(meta.id)).toBeNull();
    expect(await repo.photos.getUrl(meta.id)).toBeNull();
    await expect(repo.photos.delete(meta.id)).resolves.toBeUndefined();
  });

  it("records unknown dimensions as null", async () => {
    const meta = await repo.photos.upload(new Blob(["x"], { type: "image/jpeg" }));
    expect(meta).toMatchObject({ width: null, height: null });
  });
});

describe("simulated latency", () => {
  it("waits 200–400 ms per call by default", async () => {
    setMockDelay(200, 400);
    const start = performance.now();
    await repo.locations.list();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(195);
    expect(elapsed).toBeLessThan(600);
  });
});
