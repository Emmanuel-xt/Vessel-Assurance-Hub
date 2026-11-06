import { describe, expect, it } from "vitest";
import { GAP_WARNING_POINTS } from "@/lib/services/dashboard";
import { evidenceNeeded } from "@/lib/services/evidence";
import { isOverdue } from "@/lib/services/overdue";
import { calculateAssessmentScores } from "@/lib/services/scoring";
import type { Assessment } from "@/lib/types";
import { demoPhotoSvg, isDemoPhotoId } from "./demo-photos";
import { buildFixtures } from "./index";
import { generateHistory, STORY } from "./history";
import { AUDIT_TYPES } from "./lookups";
import { QUESTIONS } from "./questions";
import { USERS } from "./users";
import { FEATURED_VESSELS, VESSELS } from "./vessels";

const DAY = 86_400_000;
const today = new Date("2026-11-06T09:00:00Z");
const history = generateHistory({ today });
const average = (scores: (number | null)[]) => {
  const valid = scores.filter((s): s is number => s !== null);
  return valid.reduce((a, b) => a + b, 0) / valid.length;
};
const vesselId = (name: string) => VESSELS.find((v) => v.name === name)!.id;
const level = (a: Assessment) => AUDIT_TYPES.find((t) => t.id === a.auditTypeId)!.assuranceLevel;
const onVessel = (name: string) => history.assessments.filter((a) => a.vesselId === vesselId(name));
const ageDays = (a: Assessment) => (today.getTime() - Date.parse(a.submittedAt!)) / DAY;

describe("generated demo history", () => {
  it("has 300 submitted assessments over the last 6 months, in reference order", () => {
    expect(history.assessments).toHaveLength(300);
    const times = history.assessments.map((a) => Date.parse(a.submittedAt!));
    expect(Math.max(...times)).toBeLessThan(today.getTime());
    expect(Math.min(...times)).toBeGreaterThan(today.getTime() - 183 * DAY);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(history.assessments.map((a) => a.reference)).size).toBe(300);
    expect(history.assessments.every((a) => a.status === "SUBMITTED")).toBe(true);
  });

  it("is repeatable", () => {
    expect(generateHistory({ today })).toEqual(history);
  });

  it("covers every audit type and all three kinds of assessment", () => {
    expect(new Set(history.assessments.map((a) => a.auditTypeId))).toEqual(new Set(AUDIT_TYPES.map((t) => t.id)));
    expect(new Set(history.assessments.map((a) => a.kind))).toEqual(new Set(["MODULE", "START_WORK", "FULL_VESSEL"]));
    const modules = new Set(history.assessments.flatMap((a) => a.moduleIds));
    expect(modules.size).toBe(17);
  });

  it("happens on the 8 featured vessels, two per location", () => {
    const used = new Set(history.assessments.map((a) => a.snapshot.vesselName));
    expect(used).toEqual(new Set(Object.keys(FEATURED_VESSELS)));
    const perLocation = Object.values(FEATURED_VESSELS).reduce<Record<string, number>>((m, l) => ({ ...m, [l]: (m[l] ?? 0) + 1 }), {});
    expect(perLocation).toEqual({ "loc-bonga": 2, "loc-ea": 2, "loc-forcados": 2, "loc-bonny": 2 });
    for (const [name, location] of Object.entries(FEATURED_VESSELS)) {
      expect(VESSELS.find((v) => v.name === name)?.defaultLocationId).toBe(location);
    }
    expect(VESSELS).toHaveLength(41); // the full register stays
  });

  it("stores the scores the scoring rules give", () => {
    for (const a of history.assessments.slice(0, 60)) {
      const answers = history.responses
        .filter((r) => r.assessmentId === a.id)
        .map((r) => ({ moduleId: r.moduleId, answer: r.answer, weight: r.questionSnapshot.weight }));
      const scores = calculateAssessmentScores(answers, a.moduleIds);
      expect(a.overallScore).toBe(scores.overall);
      expect(a.moduleScores).toEqual(scores.byModule);
    }
  });

  it("scores mostly between 75% and 98%", () => {
    const scores = history.assessments.map((a) => a.overallScore).filter((s): s is number => s !== null);
    const inBand = scores.filter((s) => s >= 75 && s <= 98).length / scores.length;
    expect(inBand).toBeGreaterThan(0.5);
    expect(average(scores)).toBeGreaterThan(80);
    expect(average(scores)).toBeLessThan(90);
  });

  it("follows the answer rules", () => {
    const startWork = new Set(history.assessments.filter((a) => a.kind === "START_WORK").map((a) => a.id));
    expect(history.responses.some((r) => startWork.has(r.assessmentId) && r.answer === "CONCERN")).toBe(false);
    expect(history.assessments.filter((a) => a.kind === "START_WORK").every((a) => a.startWork !== null)).toBe(true);
    expect(history.assessments.every((a) => a.auditTypeId !== "at-start-work-check" || a.kind === "START_WORK")).toBe(true);
  });

  it("has a few Start Work Checks that ended in a STOP", () => {
    const noAnswers = new Set(history.responses.filter((r) => r.answer === "NO").map((r) => r.assessmentId));
    const stops = history.assessments.filter((a) => a.kind === "START_WORK" && noAnswers.has(a.id));
    expect(stops.length).toBeGreaterThanOrEqual(4);
    expect(stops.length).toBeLessThanOrEqual(12);
  });

  it("attaches placeholder photos wherever the evidence rule needs one, and they all render", () => {
    const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
    for (const r of history.responses) {
      if (evidenceNeeded(byId.get(r.questionId)!, r.answer)) expect(r.photoIds.length).toBeGreaterThan(0);
    }
    const photoIds = history.responses.flatMap((r) => r.photoIds);
    expect(photoIds.length).toBeGreaterThan(50);
    expect(new Set(photoIds).size).toBe(photoIds.length);
    for (const id of photoIds) {
      expect(isDemoPhotoId(id)).toBe(true);
      const svg = demoPhotoSvg(id)!;
      expect(svg).toContain("Demo photo · ");
      expect(svg.length).toBeLessThan(2_000);
    }
  });

  it("raises a High-risk finding for every critical control answered No", () => {
    const linked = new Map(history.findings.flatMap((f) => (f.responseId ? [[f.responseId, f] as const] : [])));
    const criticalNos = history.responses.filter((r) => r.answer === "NO" && r.questionSnapshot.criticalControl);
    expect(criticalNos.length).toBeGreaterThan(15);
    for (const r of criticalNos) expect(linked.get(r.id)?.risk).toBe("HIGH");
  });

  it("has ~80 findings in mixed states, some overdue, and plenty of Good Practice", () => {
    expect(history.findings.length).toBeGreaterThanOrEqual(65);
    expect(history.findings.length).toBeLessThanOrEqual(95);
    for (const status of ["OPEN", "IN_PROGRESS", "CLOSED"] as const) {
      expect(history.findings.filter((f) => f.status === status).length).toBeGreaterThanOrEqual(3);
    }
    for (const f of history.findings) {
      const actions = history.actions.filter((a) => a.findingId === f.id);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].reference).toBe(`${f.reference}-A1`);
      if (f.status === "CLOSED") expect(actions.every((a) => a.status === "CLOSED")).toBe(true);
    }
    const overdue = history.findings.filter(
      (f) => f.status !== "CLOSED" && history.actions.some((a) => a.findingId === f.id && isOverdue(a, today)),
    );
    expect(overdue.length).toBeGreaterThanOrEqual(5);
    expect(overdue.length).toBeLessThanOrEqual(25);
    expect(history.positiveInterventions.length).toBeGreaterThan(30);
    expect(history.responses.filter((r) => r.comment).length).toBeGreaterThan(300);
  });

  it("continues the reference counters after the history", () => {
    const year = 2026;
    const maxSeq = (prefix: string) =>
      Math.max(
        ...[...history.assessments, ...history.findings, ...history.positiveInterventions]
          .map((x) => x.reference)
          .filter((ref) => ref.startsWith(`${prefix}-${year}-`))
          .map((ref) => Number(ref.slice(-4))),
      );
    expect(history.counters[`VAH-A-${year}`]).toBe(maxSeq("VAH-A"));
    expect(history.counters[`VAH-F-${year}`]).toBe(maxSeq("VAH-F"));
  });

  it("tells the intended story", () => {
    // One clearly weaker vessel.
    const byVessel = Object.keys(FEATURED_VESSELS).map((name) => ({ name, score: average(onVessel(name).map((a) => a.overallScore)) }));
    const sorted = [...byVessel].sort((a, b) => a.score - b.score);
    expect(sorted[0].name).toBe(STORY.weak);
    expect(sorted[1].score - sorted[0].score).toBeGreaterThan(8);

    // One clearly improving vessel: the last two months well above the first two.
    const improving = onVessel(STORY.improving);
    const early = average(improving.filter((a) => ageDays(a) > 120).map((a) => a.overallScore));
    const late = average(improving.filter((a) => ageDays(a) <= 60).map((a) => a.overallScore));
    expect(late - early).toBeGreaterThan(12);

    // A self vs supervisory gap on exactly one vessel (the dashboard's warning threshold).
    const gapOf = (name: string) => {
      const list = onVessel(name);
      const self = Math.round(average(list.filter((a) => level(a) === "SELF").map((a) => a.overallScore)));
      const supervisory = Math.round(average(list.filter((a) => level(a) === "SUPERVISORY").map((a) => a.overallScore)));
      return self - supervisory;
    };
    for (const name of Object.keys(FEATURED_VESSELS)) {
      if (name === STORY.gap) expect(gapOf(name)).toBeGreaterThanOrEqual(GAP_WARNING_POINTS);
      else expect(gapOf(name)).toBeLessThan(GAP_WARNING_POINTS);
    }
  });

  it("has ~25 users across five contractor companies, with pending signups to approve", () => {
    expect(USERS).toHaveLength(25);
    expect(USERS.filter((u) => u.status === "PENDING")).toHaveLength(3);
    const contractors = new Set(USERS.map((u) => u.company).filter((c) => c !== "Project Marine Team"));
    expect(contractors.size).toBe(5);
    expect(USERS.filter((u) => u.role === "SUPERVISOR" && u.status === "ACTIVE").length).toBeGreaterThanOrEqual(3);
    expect(new Set(history.assessments.map((a) => a.snapshot.company)).size).toBe(6);
  });

  it("stays under ~2 MB of browser storage", () => {
    const bytes = JSON.stringify(buildFixtures({ today })).length;
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });
});
