import { describe, expect, it } from "vitest";
import { isOverdue } from "@/lib/services/overdue";
import { calculateAssessmentScores } from "@/lib/services/scoring";
import { buildFixtures } from "./index";
import { generateHistory } from "./history";
import { AUDIT_TYPES } from "./lookups";
import { VESSELS } from "./vessels";

const today = new Date("2026-11-05T09:00:00Z");
const history = generateHistory({ today });
const average = (scores: (number | null)[]) => {
  const valid = scores.filter((s): s is number => s !== null);
  return valid.reduce((a, b) => a + b, 0) / valid.length;
};
const vesselId = (name: string) => VESSELS.find((v) => v.name === name)!.id;
const level = (auditTypeId: string) => AUDIT_TYPES.find((t) => t.id === auditTypeId)!.assuranceLevel;

describe("generated demo history", () => {
  it("has ~300 submitted assessments over the last 6 months, in reference order", () => {
    expect(history.assessments).toHaveLength(300);
    const times = history.assessments.map((a) => Date.parse(a.submittedAt!));
    expect(Math.max(...times)).toBeLessThan(today.getTime());
    expect(Math.min(...times)).toBeGreaterThan(today.getTime() - 183 * 86_400_000);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(history.assessments.map((a) => a.reference)).size).toBe(300);
    expect(history.assessments.every((a) => a.status === "SUBMITTED")).toBe(true);
  });

  it("is repeatable", () => {
    expect(generateHistory({ today })).toEqual(history);
  });

  it("stores the scores the scoring rules give", () => {
    for (const a of history.assessments.slice(0, 50)) {
      const answers = history.responses
        .filter((r) => r.assessmentId === a.id)
        .map((r) => ({ moduleId: r.moduleId, answer: r.answer, weight: r.questionSnapshot.weight }));
      const scores = calculateAssessmentScores(answers, a.moduleIds);
      expect(a.overallScore).toBe(scores.overall);
      expect(a.moduleScores).toEqual(scores.byModule);
    }
  });

  it("follows the answer rules", () => {
    const startWork = new Set(history.assessments.filter((a) => a.kind === "START_WORK").map((a) => a.id));
    expect(history.responses.some((r) => startWork.has(r.assessmentId) && r.answer === "CONCERN")).toBe(false);
    expect(history.assessments.filter((a) => a.kind === "START_WORK").every((a) => a.startWork !== null)).toBe(true);
    expect(history.assessments.every((a) => a.auditTypeId !== "at-start-work-check" || a.kind === "START_WORK")).toBe(true);
  });

  it("raises a High-risk finding for every critical control answered No", () => {
    const linked = new Map(history.findings.flatMap((f) => (f.responseId ? [[f.responseId, f] as const] : [])));
    const criticalNos = history.responses.filter((r) => r.answer === "NO" && r.questionSnapshot.criticalControl);
    expect(criticalNos.length).toBeGreaterThan(20);
    for (const r of criticalNos) expect(linked.get(r.id)?.risk).toBe("HIGH");
  });

  it("keeps findings and actions consistent", () => {
    for (const f of history.findings) {
      const actions = history.actions.filter((a) => a.findingId === f.id);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].reference).toBe(`${f.reference}-A1`);
      if (f.status === "CLOSED") expect(actions.every((a) => a.status === "CLOSED")).toBe(true);
    }
    const overdue = history.actions.filter((a) => isOverdue(a, today));
    expect(overdue.length).toBeGreaterThan(5);
    expect(history.findings.filter((f) => f.status === "CLOSED").length).toBeGreaterThan(history.findings.length / 3);
    expect(history.positiveInterventions.length).toBeGreaterThan(10);
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
    const fleet = average(history.assessments.map((a) => a.overallScore));
    const weak = average(history.assessments.filter((a) => a.vesselId === vesselId("Dark Knight II")).map((a) => a.overallScore));
    expect(weak).toBeLessThan(fleet);

    const gapIds = ["Topaz Master", "Lady Oge", "ACE Discoverer"].map(vesselId);
    const gapChecks = history.assessments.filter((a) => gapIds.includes(a.vesselId));
    const self = average(gapChecks.filter((a) => level(a.auditTypeId) === "SELF").map((a) => a.overallScore));
    const supervisory = average(gapChecks.filter((a) => level(a.auditTypeId) === "SUPERVISORY").map((a) => a.overallScore));
    expect(self - supervisory).toBeGreaterThan(10);
  });

  it("stays small enough for browser storage", () => {
    const bytes = JSON.stringify(buildFixtures({ today })).length;
    expect(bytes).toBeLessThan(2.5 * 1024 * 1024);
  });
});
