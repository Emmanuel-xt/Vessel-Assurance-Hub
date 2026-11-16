import { describe, expect, it } from "vitest";
import { buildFixtures } from "@/lib/data/fixtures";
import {
  ALL_VESSELS,
  answerCounts,
  assessmentsLink,
  averageScore,
  bucketFor,
  bucketLabel,
  bucketStart,
  computeDashboard,
  contractorRanking,
  dashboardLayoutFor,
  dashboardQuery,
  exportRows,
  failedStartWorkChecks,
  failureBand,
  goodPracticeList,
  moduleTiles,
  naShare,
  noRate,
  overdueFindingList,
  filterAssessments,
  findingsByStatusAndRisk,
  kpis,
  lagosDateOf,
  parseDashboardFilter,
  periodDays,
  periodFor,
  prepareDashboardData,
  previousPeriod,
  scoreBy,
  scoreByModule,
  selfVsSupervisory,
  startWorkFailures,
  startWorkTrace,
  topNonCompliant,
  trend,
  type DashboardData,
  type DashboardFilter,
} from "@/lib/services/dashboard";
import type { Action, Answer, Assessment, Finding, Response } from "@/lib/types";

// ---------- Small hand-made data set ----------

const base = buildFixtures({ history: false });
let seq = 0;

function assessment(o: Partial<Assessment> & { day: string; score: number | null }): Assessment {
  seq += 1;
  const { day, score, ...rest } = o;
  return {
    id: `a${seq}`,
    reference: `VAH-A-2026-${String(seq).padStart(4, "0")}`,
    kind: "MODULE",
    moduleIds: ["mod-security"],
    userId: "usr-wkr-blessing",
    vesselId: "ves-fds",
    locationId: "loc-bonga",
    auditTypeId: "at-lod1",
    startWork: null,
    activityId: null,
    verification: null,
    status: "SUBMITTED",
    overallScore: score,
    moduleScores: { [rest.moduleIds?.[0] ?? "mod-security"]: score },
    snapshot: { userName: "Blessing Okon", company: "Coastway Marine", position: "Bridge Officer", vesselName: "FDS", packageId: "pkg-epc2" },
    createdAt: `${day}T09:00:00.000Z`,
    updatedAt: `${day}T10:00:00.000Z`,
    submittedAt: `${day}T10:00:00.000Z`,
    ...rest,
  };
}

function response(a: Assessment, questionId: string, answer: Answer, text = questionId): Response {
  return {
    id: `${a.id}-${questionId}`,
    assessmentId: a.id,
    questionId,
    moduleId: a.moduleIds[0],
    answer,
    comment: "",
    observationTag: null,
    photoIds: [],
    questionSnapshot: { text, weight: 1, criticalControl: false },
    createdAt: a.submittedAt!,
    updatedAt: a.submittedAt!,
  };
}

function finding(a: Assessment, o: Partial<Finding> = {}): Finding {
  seq += 1;
  return {
    id: `f${seq}`,
    reference: `VAH-F-2026-${String(seq).padStart(4, "0")}`,
    assessmentId: a.id,
    responseId: null,
    vesselId: a.vesselId,
    moduleId: a.moduleIds[0],
    description: "Something wrong",
    risk: "MEDIUM",
    critical: false,
    raisedById: a.userId,
    raisedAt: a.submittedAt!,
    status: "OPEN",
    closureComment: null,
    closedById: null,
    closedAt: null,
    ...o,
  };
}

function action(f: Finding, targetDate: string, status: Action["status"] = "OPEN"): Action {
  return {
    id: `${f.id}-a1`,
    reference: `${f.reference}-A1`,
    findingId: f.id,
    description: f.description,
    ownerId: "usr-sup-tunde",
    targetDate,
    status,
    closureComment: null,
    closureEvidencePhotoId: null,
    createdById: f.raisedById,
    createdAt: f.raisedAt,
    closedById: null,
    closedAt: null,
  };
}

function dataWith(partial: Partial<DashboardData>) {
  return prepareDashboardData({
    assessments: [],
    responses: [],
    findings: [],
    actions: [],
    positiveInterventions: [],
    vessels: base.vessels,
    locations: base.locations,
    packages: base.packages,
    modules: base.modules,
    auditTypes: base.auditTypes,
    startWorkActivities: [],
    people: base.users.map((u) => ({ id: u.id, name: u.name })),
    ...partial,
  });
}

const NOW = new Date("2026-11-05T09:00:00Z");
const ALL: DashboardFilter = { preset: "thisYear", scope: "all" };

// ---------- Dates ----------

describe("periods", () => {
  const today = "2026-11-05";
  it("covers each preset up to today", () => {
    expect(periodFor({ preset: "last7" }, today)).toEqual({ from: "2026-10-30", to: "2026-11-05" });
    expect(periodFor({ preset: "thisMonth" }, today)).toEqual({ from: "2026-11-01", to: "2026-11-05" });
    expect(periodFor({ preset: "lastMonth" }, today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodFor({ preset: "thisQuarter" }, today)).toEqual({ from: "2026-10-01", to: "2026-11-05" });
    expect(periodFor({ preset: "thisYear" }, today)).toEqual({ from: "2026-01-01", to: "2026-11-05" });
    expect(periodFor({ preset: "lastMonth" }, "2027-01-10")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("handles custom ranges, including missing or reversed dates", () => {
    expect(periodFor({ preset: "custom", from: "2026-06-01", to: "2026-06-30" }, today)).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    expect(periodFor({ preset: "custom", from: "2026-06-30", to: "2026-06-01" }, today)).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    expect(periodFor({ preset: "custom" }, today)).toEqual({ from: "2026-10-07", to: "2026-11-05" });
  });

  it("compares with the same number of days immediately before", () => {
    const period = { from: "2026-10-01", to: "2026-10-31" };
    expect(periodDays(period)).toBe(31);
    expect(previousPeriod(period)).toEqual({ from: "2026-08-31", to: "2026-09-30" });
  });

  it("uses Lagos dates (UTC+1)", () => {
    expect(lagosDateOf("2026-11-01T23:30:00Z")).toBe("2026-11-02");
    expect(lagosDateOf("2026-11-01T22:59:00Z")).toBe("2026-11-01");
  });
});

describe("trend buckets", () => {
  it("picks weeks, months or quarters by range length", () => {
    expect(bucketFor({ from: "2026-10-01", to: "2026-11-05" })).toBe("week");
    expect(bucketFor({ from: "2026-01-01", to: "2026-11-05" })).toBe("month");
    expect(bucketFor({ from: "2025-01-01", to: "2026-11-05" })).toBe("quarter");
  });

  it("starts weeks on Monday and labels buckets", () => {
    expect(bucketStart("2026-11-05", "week")).toBe("2026-11-02"); // Thursday → Monday
    expect(bucketStart("2026-11-02", "week")).toBe("2026-11-02");
    expect(bucketStart("2026-11-05", "quarter")).toBe("2026-10-01");
    expect(bucketLabel("2026-11-02", "week")).toBe("2 Nov");
    expect(bucketLabel("2026-11-01", "month")).toBe("Nov 2026");
    expect(bucketLabel("2026-10-01", "quarter")).toBe("Q4 2026");
  });

  it("averages per bucket and keeps empty buckets", () => {
    const list = [assessment({ day: "2026-09-10", score: 80 }), assessment({ day: "2026-09-20", score: 90 }), assessment({ day: "2026-11-02", score: 70 })];
    const data = dataWith({ assessments: list });
    const points = trend(data, list, { from: "2026-09-01", to: "2026-11-05" }, "month");
    expect(points.map((p) => [p.label, p.score, p.count])).toEqual([
      ["Sep 2026", 85, 2],
      ["Oct 2026", null, 0],
      ["Nov 2026", 70, 1],
    ]);
  });
});

// ---------- Filter and URL ----------

describe("filter in the URL", () => {
  it("round-trips and ignores unknown values", () => {
    const filter: DashboardFilter = { preset: "custom", from: "2026-06-01", to: "2026-06-30", vesselId: "ves-fds", moduleId: "mod-galley", scope: "supervisory" };
    const parsed = parseDashboardFilter(new URLSearchParams(dashboardQuery(filter)));
    expect(parsed).toEqual(filter);
    expect(dashboardQuery({ preset: "thisYear", scope: "all" })).toBe("");
    expect(parseDashboardFilter(new URLSearchParams("range=forever&scope=nobody&from=bad"))).toEqual({ preset: "thisYear", scope: "all" });
  });

  it("links to the matching All assessments list", () => {
    const link = assessmentsLink({ preset: "thisMonth", scope: "self", locationId: "loc-onne" }, { from: "2026-11-01", to: "2026-11-05" }, { vesselId: "ves-fds", questionId: "q-galley-02" });
    const params = new URL(link, "http://x").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      view: "all",
      from: "2026-11-01",
      to: "2026-11-05",
      vessel: "ves-fds",
      location: "loc-onne",
      scope: "self",
      question: "q-galley-02",
    });
  });
});

describe("filterAssessments", () => {
  const a = assessment({ day: "2026-10-10", score: 90 });
  const b = assessment({ day: "2026-10-12", score: 70, auditTypeId: "at-mfe", vesselId: "ves-bl216", locationId: "loc-onne" });
  const c = assessment({ day: "2026-10-14", score: 80, kind: "FULL_VESSEL", moduleIds: ["mod-security", "mod-galley"], snapshot: { ...a.snapshot, packageId: "pkg-epc1" } });
  const late = assessment({ day: "2026-10-31", score: 60, submittedAt: "2026-10-31T23:30:00.000Z" }); // 1 Nov in Lagos
  const data = dataWith({ assessments: [a, b, c, late] });
  const october = { from: "2026-10-01", to: "2026-10-31" };
  const ids = (list: Assessment[]) => list.map((x) => x.id);

  it("filters by date (Lagos), dimension and scope", () => {
    expect(ids(filterAssessments(data, ALL, october))).toEqual([a.id, b.id, c.id]);
    expect(ids(filterAssessments(data, { ...ALL, scope: "supervisory" }, october))).toEqual([b.id]);
    expect(ids(filterAssessments(data, { ...ALL, scope: "self" }, october))).toEqual([a.id, c.id]);
    expect(ids(filterAssessments(data, { ...ALL, moduleId: "mod-galley" }, october))).toEqual([c.id]);
    expect(ids(filterAssessments(data, { ...ALL, packageId: "pkg-epc1" }, october))).toEqual([c.id]);
    expect(ids(filterAssessments(data, { ...ALL, vesselId: "ves-bl216", locationId: "loc-onne" }, october))).toEqual([b.id]);
  });
});

// ---------- Aggregates ----------

describe("scores", () => {
  it("averages existing scores only", () => {
    expect(averageScore([80, null, 91])).toBe(86);
    expect(averageScore([null])).toBeNull();
  });

  it("scores by dimension, lowest first, with colour bands", () => {
    const list = [
      assessment({ day: "2026-10-01", score: 95, vesselId: "ves-fds" }),
      assessment({ day: "2026-10-02", score: 85, vesselId: "ves-fds" }),
      assessment({ day: "2026-10-03", score: 70, vesselId: "ves-bl216", snapshot: { userName: "x", company: "Bluewake Vessel Management", position: "x", vesselName: "BL216", packageId: "pkg-epc2" } }),
      assessment({ day: "2026-10-04", score: null, vesselId: "ves-a60" }),
    ];
    const data = dataWith({ assessments: list });
    expect(scoreBy(data, list, "vessel").map((r) => [r.name, r.score, r.band, r.count])).toEqual([
      ["BL216", 70, "red", 1],
      ["FDS", 90, "green", 2],
      ["A60", null, "none", 1],
    ]);
    expect(contractorRanking(data, list).map((r) => [r.name, r.score])).toEqual([
      ["Coastway Marine", 90],
      ["Bluewake Vessel Management", 70],
    ]);
  });

  it("scores modules from module scores, so Full Vessel counts for each module", () => {
    const list = [
      assessment({ day: "2026-10-01", score: 80, moduleIds: ["mod-security"], moduleScores: { "mod-security": 80 } }),
      assessment({ day: "2026-10-02", score: 75, kind: "FULL_VESSEL", moduleIds: ["mod-security", "mod-galley"], moduleScores: { "mod-security": 100, "mod-galley": 50 } }),
    ];
    const data = dataWith({ assessments: list });
    expect(scoreByModule(data, list).map((r) => [r.name, r.score, r.count])).toEqual([
      ["Galley", 50, 1],
      ["Security", 90, 2],
    ]);
  });

  it("compares self and supervisory scores per vessel and flags big gaps", () => {
    const list = [
      assessment({ day: "2026-10-01", score: 96, vesselId: "ves-topaz-master" }),
      assessment({ day: "2026-10-02", score: 60, vesselId: "ves-topaz-master", auditTypeId: "at-mfe" }),
      assessment({ day: "2026-10-03", score: 90, vesselId: "ves-fds" }),
      assessment({ day: "2026-10-04", score: 85, vesselId: "ves-fds", auditTypeId: "at-mfe" }),
      assessment({ day: "2026-10-05", score: 90, vesselId: "ves-a60" }), // self only: left out
    ];
    const rows = selfVsSupervisory(dataWith({ assessments: list }), list);
    expect(rows.map((r) => [r.name, r.self, r.supervisory, r.gap, r.warning])).toEqual([
      ["Topaz Master", 96, 60, 36, true],
      ["FDS", 90, 85, 5, false],
    ]);
  });
});

describe("findings, KPIs and top No answers", () => {
  const a = assessment({ day: "2026-10-20", score: 80, kind: "START_WORK", auditTypeId: "at-start-work-check", moduleIds: ["mod-hot-work"] });
  const b = assessment({ day: "2026-10-21", score: 100 });
  const old = assessment({ day: "2026-09-15", score: 60 });
  const open = finding(a, { risk: "HIGH" });
  const closed = finding(b, { status: "CLOSED", risk: "LOW" });
  const progress = finding(b, { status: "IN_PROGRESS" });
  const data = dataWith({
    assessments: [a, b, old],
    responses: [
      response(a, "q-hot-work-06", "NO", "Gas testing"),
      response(b, "q-security-01", "YES"),
      response(old, "q-hot-work-06", "NO", "Gas testing"),
      response(old, "q-security-02", "NO", "Visitor register"),
    ],
    findings: [open, closed, progress],
    actions: [action(open, "2026-10-27"), action(closed, "2026-10-01", "CLOSED"), action(progress, "2026-12-01")],
    positiveInterventions: [
      { id: "p1", reference: "VAH-P-2026-0001", assessmentId: b.id, responseId: null, vesselId: b.vesselId, moduleId: null, description: "x", recordedById: b.userId, recordedAt: b.submittedAt! },
    ],
  });

  it("counts KPIs with the change vs the previous period", () => {
    const result = kpis(data, [a, b], [old], NOW);
    expect(result).toEqual({
      fleetScore: 90,
      previousScore: 60,
      change: 30,
      submitted: 2,
      previousSubmitted: 1,
      openFindings: 2,
      overdueFindings: 1,
      goodPractice: 1,
      stopChecks: 1,
    });
  });

  it("splits findings by status and risk", () => {
    expect(findingsByStatusAndRisk(data, [a, b])).toEqual([
      { status: "OPEN", LOW: 0, MEDIUM: 0, HIGH: 1, total: 1 },
      { status: "IN_PROGRESS", LOW: 0, MEDIUM: 1, HIGH: 0, total: 1 },
      { status: "CLOSED", LOW: 1, MEDIUM: 0, HIGH: 0, total: 1 },
    ]);
  });

  it("ranks the questions answered No most often", () => {
    expect(topNonCompliant(data, [a, b, old]).map((q) => [q.questionId, q.count, q.moduleName])).toEqual([
      ["q-hot-work-06", 2, "Hot Work"],
      ["q-security-02", 1, "Security"],
    ]);
    expect(topNonCompliant(data, [a, b, old], 1)).toHaveLength(1);
  });

  it("builds the four export sheets", () => {
    const sheets = exportRows(data, [a, b], NOW);
    expect(sheets.Assessments).toHaveLength(2);
    expect(sheets.Assessments[0]).toMatchObject({ Reference: a.reference, Type: "Start Work Check", "Self / Supervisory": "Self", "Score %": 80, "No answers": 1 });
    expect(sheets.Responses.map((r) => r.Answer)).toEqual(["Non-Compliant", "Yes"]);
    expect(sheets.Findings).toHaveLength(3);
    expect(sheets.Findings.find((f) => f.Reference === open.reference)).toMatchObject({ Risk: "High", Overdue: "Yes", "Next due": "2026-10-27" });
    expect(sheets["Start Work"]).toEqual([
      { Task: "Hot Work", Checks: 1, "Stopped (any No)": 1, "Stopped %": 100, "No % (N/A left out)": 100, "N/A % of answers": 0 },
    ]);
  });
});

// ---------- N/A, Start Work failures, follow-up, tiles, roles ----------

describe("N/A never passes or fails anything", () => {
  it("is left out of the No rate but counted on its own", () => {
    const c = answerCounts([{ answer: "YES" }, { answer: "NO" }, { answer: "NA" }]);
    expect(c).toEqual({ yes: 1, concern: 0, no: 1, na: 1, total: 3, applicable: 2 });
    expect(noRate(c)).toBe(50);
    expect(naShare(c)).toBe(33);
    const allNa = answerCounts([{ answer: "NA" }, { answer: "NA" }]);
    expect(noRate(allNa)).toBeNull();
    expect(naShare(allNa)).toBe(100);
  });

  it("does not stop a Start Work Check", () => {
    const sw = assessment({ day: "2026-10-20", score: 100, kind: "START_WORK", auditTypeId: "at-start-work-check", moduleIds: ["mod-hot-work"] });
    const data = dataWith({
      assessments: [sw],
      responses: [response(sw, "q-hot-work-01", "YES"), response(sw, "q-hot-work-02", "NA"), response(sw, "q-hot-work-03", "NA")],
    });
    expect(startWorkFailures(data, [sw])).toMatchObject({ checks: 1, failed: 0, failureRate: 0 });
    expect(startWorkFailures(data, [sw]).tasks[0]).toMatchObject({ noRate: 0, naShare: 67 });
  });
});

describe("Start Work Check failures and the trace", () => {
  const activity = {
    id: "act-1",
    reference: "VAH-S-2026-0007",
    code: "K7P4QX",
    moduleId: "mod-hot-work",
    vesselId: "ves-fds",
    locationId: "loc-bonga",
    taskDescription: "Weld the rail",
    teamSize: 3,
    createdById: "usr-aud-kemi",
    status: "CLOSED" as const,
    closedById: "usr-aud-kemi",
    closedAt: "2026-10-21T12:00:00.000Z",
    closureComment: null,
    snapshot: { vesselName: "FDS", packageId: "pkg-epc2", createdByName: "Kemi Olatunji" },
    createdAt: "2026-10-21T08:00:00.000Z",
    updatedAt: "2026-10-21T12:00:00.000Z",
  };
  const sw = (day: string, vesselId = "ves-fds", moduleId = "mod-hot-work") =>
    assessment({ day, score: 80, kind: "START_WORK", auditTypeId: "at-start-work-check", moduleIds: [moduleId], vesselId, activityId: activity.id });
  const h1 = sw("2026-10-01");
  const h2 = sw("2026-10-02");
  const h3 = sw("2026-10-03", "ves-dark-knight-ii");
  const h4 = sw("2026-10-04", "ves-dark-knight-ii");
  const d1 = sw("2026-10-05", "ves-fds", "mod-deck-work");
  const moduleCheck = assessment({ day: "2026-10-06", score: 50 });
  const list = [h1, h2, h3, h4, d1, moduleCheck];
  const data = dataWith({
    assessments: list,
    startWorkActivities: [activity],
    responses: [
      response(h1, "q-hot-work-03", "NO", "Gas test"),
      response(h1, "q-hot-work-04", "NO", "Hazardous area"),
      response(h2, "q-hot-work-03", "YES", "Gas test"),
      response(h2, "q-hot-work-04", "NA", "Hazardous area"),
      response(h3, "q-hot-work-03", "NO", "Gas test"),
      response(h3, "q-hot-work-04", "NA", "Hazardous area"),
      response(h4, "q-hot-work-03", "NO", "Gas test"),
      response(h4, "q-hot-work-04", "YES", "Hazardous area"),
      response(d1, "q-deck-work-01", "YES"),
      response(moduleCheck, "q-security-01", "NO"),
    ],
  });

  it("counts a check as failed when any item is No, per task, worst first; module checks are ignored", () => {
    const result = startWorkFailures(data, list);
    expect(result).toMatchObject({ checks: 5, failed: 3, failureRate: 60, band: "red" });
    expect(result.tasks.map((t) => [t.name, t.checks, t.failed, t.failureRate, t.noRate, t.naShare])).toEqual([
      ["Hot Work", 4, 3, 75, 67, 25],
      ["Deck Work", 1, 0, 0, 0, 0],
    ]);
    expect(failureBand(10)).toBe("green");
    expect(failureBand(25)).toBe("amber");
    expect(failureBand(26)).toBe("red");
    expect(failureBand(null)).toBe("none");
  });

  it("traces STOPs to items (N/A left out), vessels and checks", () => {
    const trace = startWorkTrace(data, list, "mod-hot-work");
    expect(trace).toMatchObject({ checks: 4, failed: 3, failureRate: 75 });
    expect(trace.items.map((i) => [i.questionId, i.stops, i.stopShare, i.noRate, i.naShare])).toEqual([
      ["q-hot-work-03", 3, 100, 75, 0],
      ["q-hot-work-04", 1, 33, 50, 50],
    ]);
    expect(trace.vessels.map((v) => [v.id, v.checks, v.failed, v.failureRate])).toEqual([
      ["ves-dark-knight-ii", 2, 2, 100],
      ["ves-fds", 2, 1, 50],
    ]);
    expect(trace.failedChecks.map((c) => c.assessmentId)).toEqual([h4.id, h3.id, h1.id]);
    expect(trace.failedChecks[2]).toMatchObject({
      activity: { id: "act-1", reference: "VAH-S-2026-0007", createdByName: "Kemi Olatunji" },
      noItems: ["Gas test", "Hazardous area"],
      person: "Blessing Okon",
    });
    expect(startWorkTrace(data, list, "mod-hot-work", 1).failedChecks).toHaveLength(1);
    expect(failedStartWorkChecks(data, list, 2)).toMatchObject({ total: 3, rows: [{ assessmentId: h4.id }, { assessmentId: h3.id }] });
  });
});

describe("Auditor follow-up lists", () => {
  const a = assessment({ day: "2026-10-01", score: 70 });
  const b = assessment({ day: "2026-10-02", score: 90 });
  const late = finding(a, { risk: "HIGH" });
  const later = finding(b);
  const onTime = finding(b);
  const data = dataWith({
    assessments: [a, b],
    findings: [late, later, onTime],
    actions: [action(late, "2026-10-20"), action(later, "2026-11-01"), action(onTime, "2026-12-01")],
    positiveInterventions: [
      { id: "p1", reference: "VAH-P-2026-0001", assessmentId: a.id, responseId: null, vesselId: a.vesselId, moduleId: "mod-security", description: "Tidy gangway", recordedById: a.userId, recordedAt: a.submittedAt! },
      { id: "p2", reference: "VAH-P-2026-0002", assessmentId: b.id, responseId: null, vesselId: b.vesselId, moduleId: null, description: "Good toolbox talk", recordedById: b.userId, recordedAt: b.submittedAt! },
    ],
  });

  it("lists overdue findings, most overdue first, with the action owner", () => {
    const result = overdueFindingList(data, [a, b], NOW);
    expect(result.total).toBe(2);
    expect(result.rows.map((r) => [r.reference, r.daysOverdue, r.ownerName, r.risk])).toEqual([
      [late.reference, 16, "Tunde Bakare", "HIGH"],
      [later.reference, 4, "Tunde Bakare", "MEDIUM"],
    ]);
  });

  it("lists Good Practice newest first", () => {
    const result = goodPracticeList(data, [a, b], 1);
    expect(result.total).toBe(2);
    expect(result.rows).toMatchObject([{ reference: "VAH-P-2026-0002", recordedBy: "Blessing Okon", moduleName: null }]);
  });
});

describe("module tiles", () => {
  const fds = assessment({ day: "2026-10-01", score: 60, moduleIds: ["mod-security"] });
  const dk = assessment({ day: "2026-10-02", score: 100, moduleIds: ["mod-security"], vesselId: "ves-dark-knight-ii" });
  const galley = assessment({ day: "2026-10-03", score: 90, moduleIds: ["mod-galley"], moduleScores: { "mod-galley": 90 } });
  const stop = assessment({ day: "2026-10-04", score: 50, kind: "START_WORK", auditTypeId: "at-start-work-check", moduleIds: ["mod-hot-work"], moduleScores: { "mod-hot-work": 50 } });
  const data = dataWith({ assessments: [fds, dk, galley, stop], responses: [response(stop, "q-hot-work-03", "NO")] });
  const period = periodFor(ALL, "2026-11-05");

  it("ignore the top-bar module filter, group Assurance and Start Work, lowest first", () => {
    const tiles = moduleTiles(data, { ...ALL, moduleId: "mod-galley" }, period);
    expect(tiles.assurance.map((t) => [t.id, t.score, t.count])).toEqual([
      ["mod-security", 80, 2],
      ["mod-galley", 90, 1],
    ]);
    expect(tiles.startWork).toMatchObject([{ id: "mod-hot-work", score: 50, failureRate: 100, failureBand: "red" }]);
    expect(tiles.withoutData.assurance).toBe(8);
    expect(tiles.withoutData.startWork).toBe(16);
  });

  it("use their own vessel filter, else follow the top bar", () => {
    expect(moduleTiles(data, { ...ALL, tileVesselId: "ves-dark-knight-ii" }, period).assurance).toMatchObject([{ id: "mod-security", score: 100 }]);
    expect(moduleTiles(data, { ...ALL, vesselId: "ves-dark-knight-ii" }, period).vesselId).toBe("ves-dark-knight-ii");
    const all = moduleTiles(data, { ...ALL, vesselId: "ves-dark-knight-ii", tileVesselId: ALL_VESSELS }, period);
    expect(all.vesselId).toBeNull();
    expect(all.assurance.find((t) => t.id === "mod-security")?.count).toBe(2);
    expect(parseDashboardFilter(new URLSearchParams(dashboardQuery({ ...ALL, tileVesselId: ALL_VESSELS }))).tileVesselId).toBe(ALL_VESSELS);
  });
});

describe("what each role sees", () => {
  it("gives the Auditor the follow-up cards, the Supervisor the fleet cards, the Admin everything", () => {
    expect(dashboardLayoutFor("AUDITOR")).toMatchObject({
      cards: ["overdueFindings", "stopChecks", "goodPractice"],
      followUp: true,
      startWork: true,
      fleetBreakdowns: false,
    });
    expect(dashboardLayoutFor("SUPERVISOR")).toMatchObject({
      cards: ["fleetScore", "submitted", "openFindings"],
      followUp: false,
      startWork: false,
      fleetBreakdowns: true,
    });
    expect(dashboardLayoutFor("ADMIN").cards).toHaveLength(6);
    expect(dashboardLayoutFor("ADMIN")).toMatchObject({ startWork: true, fleetBreakdowns: true });
  });
});

// ---------- On the real demo history ----------

describe("computeDashboard on the demo history", () => {
  const data = prepareDashboardData(
    (() => {
      const all = buildFixtures({ today: NOW });
      return {
        ...all,
        assessments: all.assessments.filter((a) => a.status === "SUBMITTED"),
        people: all.users.map((u) => ({ id: u.id, name: u.name })),
      };
    })(),
  );

  it("produces every view for the default filter", () => {
    const view = computeDashboard(data, { preset: "thisYear", scope: "all" }, NOW);
    expect(view.kpis.submitted).toBe(data.assessments.length);
    expect(view.kpis.submitted).toBeGreaterThan(280);
    expect(view.kpis.fleetScore).toBeGreaterThan(70);
    expect(view.bucket).toBe("month");
    expect(view.trend.length).toBe(11);
    expect(view.byVessel).toHaveLength(8); // the demo history uses the 8 featured vessels
    expect(view.selfVsSupervisory.some((r) => r.warning)).toBe(true);
    expect(view.topNonCompliant).toHaveLength(10);
    // Start Work failures: the demo's recurring problems show up and can be traced to the item.
    expect(view.startWork.checks).toBeGreaterThan(40);
    expect(view.startWork.failed).toBe(view.kpis.stopChecks);
    const hot = startWorkTrace(data, view.assessments, "mod-hot-work");
    expect(hot.failed).toBeGreaterThan(0);
    expect(hot.items.slice(0, 3).map((i) => i.questionId)).toContain("q-hot-work-03");
    expect(view.tiles.assurance.length).toBe(10);
    expect(view.followUp.overdue.total).toBeGreaterThan(0);
  });

  it("stays fast (< 50 ms per filter change on ~300 assessments)", () => {
    computeDashboard(data, ALL, NOW); // warm-up
    const filters: DashboardFilter[] = [
      ALL,
      { preset: "thisQuarter", scope: "supervisory" },
      { preset: "last7", scope: "self", locationId: "loc-bonga" },
      { preset: "custom", from: "2026-05-01", to: "2026-11-05", scope: "all", moduleId: "mod-security" },
    ];
    // Best of 5 runs per filter: the test files run in parallel, so a single run also measures scheduler noise.
    const bestOf = (f: DashboardFilter, runs = 5) =>
      Math.min(
        ...Array.from({ length: runs }, () => {
          const start = performance.now();
          computeDashboard(data, f, NOW);
          return performance.now() - start;
        }),
      );
    const times = filters.map((f) => bestOf(f));
    expect(Math.max(...times)).toBeLessThan(50);
  });
});
