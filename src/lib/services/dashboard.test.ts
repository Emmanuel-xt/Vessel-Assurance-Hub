import { describe, expect, it } from "vitest";
import { buildFixtures } from "@/lib/data/fixtures";
import {
  assessmentsLink,
  averageScore,
  bucketFor,
  bucketLabel,
  bucketStart,
  computeDashboard,
  contractorRanking,
  dashboardQuery,
  exportRows,
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
    auditTypeId: "at-self-assessment",
    startWork: null,
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
    const link = assessmentsLink({ preset: "thisMonth", scope: "self", locationId: "loc-ea" }, { from: "2026-11-01", to: "2026-11-05" }, { vesselId: "ves-fds", questionId: "q-galley-02" });
    const params = new URL(link, "http://x").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      view: "all",
      from: "2026-11-01",
      to: "2026-11-05",
      vessel: "ves-fds",
      location: "loc-ea",
      scope: "self",
      question: "q-galley-02",
    });
  });
});

describe("filterAssessments", () => {
  const a = assessment({ day: "2026-10-10", score: 90 });
  const b = assessment({ day: "2026-10-12", score: 70, auditTypeId: "at-mfe", vesselId: "ves-bl216", locationId: "loc-ea" });
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
    expect(ids(filterAssessments(data, { ...ALL, vesselId: "ves-bl216", locationId: "loc-ea" }, october))).toEqual([b.id]);
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
      assessment({ day: "2026-10-04", score: 85, vesselId: "ves-fds", auditTypeId: "at-spot-check" }),
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

  it("builds the three export sheets", () => {
    const sheets = exportRows(data, [a, b], NOW);
    expect(sheets.Assessments).toHaveLength(2);
    expect(sheets.Assessments[0]).toMatchObject({ Reference: a.reference, Type: "Start Work Check", "Self / Supervisory": "Self", "Score %": 80, "No answers": 1 });
    expect(sheets.Responses.map((r) => r.Answer)).toEqual(["Non-Compliant", "Yes"]);
    expect(sheets.Findings).toHaveLength(3);
    expect(sheets.Findings.find((f) => f.Reference === open.reference)).toMatchObject({ Risk: "High", Overdue: "Yes", "Next due": "2026-10-27" });
  });
});

// ---------- On the real demo history ----------

describe("computeDashboard on the demo history", () => {
  const data = prepareDashboardData(
    (() => {
      const all = buildFixtures({ today: NOW });
      return { ...all, assessments: all.assessments.filter((a) => a.status === "SUBMITTED") };
    })(),
  );

  it("produces every view for the default filter", () => {
    const view = computeDashboard(data, { preset: "thisYear", scope: "all" }, NOW);
    expect(view.kpis.submitted).toBe(300);
    expect(view.kpis.fleetScore).toBeGreaterThan(70);
    expect(view.bucket).toBe("month");
    expect(view.trend.length).toBe(11);
    expect(view.byVessel).toHaveLength(8); // the demo history uses the 8 featured vessels
    expect(view.selfVsSupervisory.some((r) => r.warning)).toBe(true);
    expect(view.topNonCompliant).toHaveLength(10);
  });

  it("stays fast (< 50 ms per filter change on ~300 assessments)", () => {
    computeDashboard(data, ALL, NOW); // warm-up
    const filters: DashboardFilter[] = [
      ALL,
      { preset: "thisQuarter", scope: "supervisory" },
      { preset: "last7", scope: "self", locationId: "loc-bonga" },
      { preset: "custom", from: "2026-05-01", to: "2026-11-05", scope: "all", moduleId: "mod-security" },
    ];
    const times = filters.map((f) => {
      const start = performance.now();
      computeDashboard(data, f, NOW);
      return performance.now() - start;
    });
    expect(Math.max(...times)).toBeLessThan(50);
  });
});
