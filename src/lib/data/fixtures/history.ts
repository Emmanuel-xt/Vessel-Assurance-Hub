// MOCK: ~6 months of generated demo history (assessments, answers, findings, actions, activity, positive
// interventions), so the dashboard tells a story from the first click. Seeded, so every reset produces the same
// pattern; dates are relative to "today" so the demo always looks current. Production: remove (CLAUDE.md §14).
//
// The story: most vessels score in the 80s–90s and improve slowly; a few vessels are weak; on a few others the crew's
// self-assessments look fine but supervisory audits score much lower (the warning sign the dashboard highlights);
// a handful of questions (gas testing, permits, toolbox talks, fatigue, drills…) are answered No again and again.

import { calculateAssessmentScores } from "@/lib/services/scoring";
import { formatActionReference, formatReference, referenceYear, sequenceKey } from "@/lib/services/references";
import type {
  Action,
  Answer,
  Assessment,
  AssessmentKind,
  AuditType,
  Finding,
  FindingActivity,
  ID,
  ObservationTag,
  PositiveIntervention,
  Question,
  Response,
  RiskLevel,
  User,
  Vessel,
  WorkStatus,
} from "@/lib/types";
import { AUDIT_TYPES, LOCATIONS } from "./lookups";
import { MODULES } from "./modules";
import { QUESTIONS } from "./questions";
import { USERS } from "./users";
import { VESSELS } from "./vessels";

export interface DemoHistory {
  assessments: Assessment[];
  responses: Response[];
  findings: Finding[];
  actions: Action[];
  findingActivities: FindingActivity[];
  positiveInterventions: PositiveIntervention[];
  /** Last used reference number per sequence, e.g. { "VAH-A-2026": 301 }. */
  counters: Record<string, number>;
}

export interface HistoryOptions {
  today?: Date;
  /** Number of submitted assessments. */
  count?: number;
  /** How far back, in days. */
  days?: number;
  seed?: number;
}

const DAY = 86_400_000;
const LAGOS_OFFSET = 3_600_000; // Africa/Lagos is UTC+1 all year

/** Same defaults as the finding service (High +7, Medium +14, Low +30); duplicated to keep fixtures dependency-free. */
const TARGET_DAYS: Record<RiskLevel, number> = { HIGH: 7, MEDIUM: 14, LOW: 30 };

// ---------- Story settings ----------

const WEAK_VESSELS = ["Dark Knight II", "BL216", "Greenbarge 4", "Surfer 1903"];
const GAP_VESSELS = ["Topaz Master", "Lady Oge", "ACE Discoverer"];
const STRONG_VESSELS = ["Normand Sentinel", "Blue Gretha", "IGM Amethyst"];

/** Answered No far more often than the rest. */
const PROBLEM_QUESTIONS = new Set([
  "q-hot-work-06", // gas testing
  "q-marine-start-work-08", // permit to work
  "q-marine-start-work-10", // toolbox talk
  "q-galley-02", // food storage temperatures
  "q-occupational-health-03", // fatigue / work-rest hours
  "q-emergency-preparedness-03", // drills current
  "q-learning-action-closure-02", // previous actions closed with evidence
  "q-bunkering-07", // hoses in date
  "q-cargo-operations-06", // lifting equipment certified
  "q-working-at-height-07", // harness inspection
]);

const NO_COMMENTS = [
  "Not in place when checked on deck.",
  "Records not available on board.",
  "Certificate has expired.",
  "Crew had not been briefed.",
  "Equipment found defective.",
  "Procedure not followed on this shift.",
  "Checked with the Master: still waiting for the contractor.",
  "Logbook entries missing for the last week.",
];

const CONCERN_COMMENTS = [
  "In place but not everyone was aware.",
  "Partly done; follow-up needed.",
  "Records incomplete.",
  "Due for renewal soon.",
];

const GOOD_PRACTICE = [
  "Crew ran an unannounced drill and debriefed well.",
  "Excellent toolbox talk led by the bosun.",
  "Permit board fully up to date and clearly displayed.",
  "Galley spotless and temperature logs complete.",
  "Young crew member used Stop Work Authority correctly.",
  "Master shared recent learnings at the morning meeting.",
];

const ACTION_TEXT = [
  "Correct on board and send photo evidence.",
  "Brief the crew and record attendance.",
  "Replace or recertify the equipment.",
  "Update the procedure and re-brief the team.",
  "Raise with the contractor and confirm close-out.",
];

const TASKS: Record<string, string[]> = {
  "mod-marine-start-work": ["Deck crane lift of containers", "Mooring operations at the buoy", "Anchor handling preparation"],
  "mod-working-at-height": ["Replace navigation light on the mast", "Inspect antenna on the monkey island", "Paint the funnel"],
  "mod-confined-space-entry": ["Inspect ballast tank 3 port", "Clean fuel oil day tank", "Survey void space aft"],
  "mod-hot-work": ["Weld new bracket on the aft deck", "Cut and replace deck plating", "Repair handrail by welding"],
  "mod-energy-isolation": ["Replace hydraulic hose on deck crane 2", "Overhaul main engine cooling pump", "Change breaker in switchboard"],
};

// ---------- Helpers ----------

/** Small seeded random generator (mulberry32). */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const pad = (n: number, width = 4) => String(n).padStart(width, "0");
const lagosDate = (ms: number) => new Date(ms + LAGOS_OFFSET).toISOString().slice(0, 10);
const iso = (ms: number) => new Date(ms).toISOString();

export function generateHistory(options: HistoryOptions = {}): DemoHistory {
  const { today = new Date(), count = 300, days = 182, seed = 20261105 } = options;
  const random = seeded(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  const chance = (p: number) => random() < p;
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const weighted = <T>(entries: [T, number][]): T => {
    let roll = random() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [value, weight] of entries) if ((roll -= weight) < 0) return value;
    return entries[entries.length - 1][0];
  };

  const todayMs = today.getTime();
  const lagosMidnight = Date.parse(`${lagosDate(todayMs)}T00:00:00+01:00`);

  const active = USERS.filter((u) => u.status === "ACTIVE");
  const workers = active.filter((u) => u.role === "WORKER");
  const supervisors = active.filter((u) => u.role === "SUPERVISOR");
  const admins = active.filter((u) => u.role === "ADMIN");
  const vessels = VESSELS.filter((v) => v.status === "ACTIVE");
  const byName = (names: string[]) => new Set(VESSELS.filter((v) => names.includes(v.name)).map((v) => v.id));
  const weak = byName(WEAK_VESSELS);
  const gap = byName(GAP_VESSELS);
  const strong = byName(STRONG_VESSELS);

  const auditType = (code: string) => AUDIT_TYPES.find((t) => t.code === code)!;
  const selfType = auditType("SELF_ASSESSMENT");
  const startWorkType = auditType("START_WORK_CHECK");
  const supervisoryTypes: [AuditType, number][] = [
    [auditType("MFE"), 4],
    [auditType("SPOT_CHECK"), 3],
    [auditType("VERIFICATION"), 2],
  ];
  const assuranceModules = MODULES.filter((m) => m.active && m.category === "ASSURANCE");
  const startWorkModules = MODULES.filter((m) => m.active && m.category === "START_WORK");

  const applicable = (moduleId: ID, vessel: Vessel, auditTypeId: ID): Question[] =>
    QUESTIONS.filter(
      (q) =>
        q.active &&
        q.moduleId === moduleId &&
        (q.vesselTypeIds.length === 0 || q.vesselTypeIds.includes(vessel.vesselTypeId)) &&
        (q.auditTypeIds.length === 0 || q.auditTypeIds.includes(auditTypeId)),
    ).sort((a, b) => a.displayOrder - b.displayOrder);

  // Submission moments: spread over the period, slightly busier recently, in daytime (06:00–18:59 Lagos).
  const moments = Array.from({ length: count }, () => {
    const daysAgo = 1 + Math.floor((days - 1) * Math.pow(random(), 1.15));
    return lagosMidnight - daysAgo * DAY + (between(6, 18) * 60 + between(0, 59)) * 60_000;
  }).sort((a, b) => a - b);

  const history: DemoHistory = {
    assessments: [],
    responses: [],
    findings: [],
    actions: [],
    findingActivities: [],
    positiveInterventions: [],
    counters: {},
  };
  const next = (kind: "assessment" | "finding" | "positiveIntervention", ms: number) => {
    const year = referenceYear(new Date(ms));
    const key = sequenceKey(kind, year);
    history.counters[key] = (history.counters[key] ?? 0) + 1;
    return formatReference(kind, year, history.counters[key]);
  };
  let ids = 0;
  const id = (prefix: string) => `hist-${prefix}-${pad(++ids, 6)}`;

  for (const submittedMs of moments) {
    const progress = 1 - (lagosMidnight - submittedMs) / (days * DAY); // 0 = oldest, 1 = now

    // ---- What kind of check, by whom, where
    const kind: AssessmentKind = weighted([
      ["MODULE", 62],
      ["START_WORK", 30],
      ["FULL_VESSEL", 8],
    ]);
    let type: AuditType;
    if (kind === "START_WORK") type = startWorkType;
    else if (kind === "FULL_VESSEL") type = chance(0.8) ? weighted(supervisoryTypes) : selfType;
    else type = chance(0.55) ? selfType : weighted(supervisoryTypes);
    const supervisory = type.assuranceLevel === "SUPERVISORY";

    let user: User;
    if (supervisory) user = chance(0.85) ? pick(supervisors) : pick(admins);
    else if (kind === "START_WORK") user = chance(0.9) ? pick(workers) : pick(supervisors);
    else user = chance(0.75) ? pick(workers) : pick(supervisors);

    // Weak and "gap" vessels get audited more often, so their pattern is clear on the dashboard.
    const vessel = weighted(vessels.map((v): [Vessel, number] => [v, weak.has(v.id) || gap.has(v.id) ? 3 : 1]));
    const locationId = chance(0.85) ? vessel.defaultLocationId : pick(LOCATIONS).id;

    let moduleIds: ID[];
    if (kind === "FULL_VESSEL") moduleIds = assuranceModules.map((m) => m.id);
    else if (kind === "START_WORK") moduleIds = [pick(startWorkModules).id];
    else {
      const usable = assuranceModules.filter((m) => applicable(m.id, vessel, type.id).length > 0);
      moduleIds = [pick(usable).id];
    }

    // ---- How likely a No is for this check
    let pNo = 0.075;
    if (weak.has(vessel.id)) pNo += 0.09;
    if (supervisory) pNo += 0.04;
    if (gap.has(vessel.id)) pNo += supervisory ? 0.14 : -0.02;
    if (strong.has(vessel.id)) pNo *= 0.5;
    pNo *= 1.25 - 0.5 * progress; // slow improvement over the months

    const assessmentId = id("a");
    const createdMs = submittedMs - between(8, 45) * 60_000;
    const answers: Response[] = [];
    for (const moduleId of moduleIds) {
      for (const question of applicable(moduleId, vessel, type.id)) {
        const p = Math.min(0.6, pNo + (PROBLEM_QUESTIONS.has(question.id) ? 0.12 : 0));
        const pNa = question.criticalControl ? 0.01 : 0.03;
        const roll = random();
        let answer: Answer =
          roll < p ? "NO" : roll < p + p * 0.7 ? "CONCERN" : roll < p + p * 0.7 + pNa ? "NA" : "YES";
        if (kind === "START_WORK" && answer === "CONCERN") answer = "YES"; // Start Work: Yes / No / N/A only

        let comment = "";
        let tag: ObservationTag | null = null;
        if (answer === "NO" && chance(0.65)) comment = pick(NO_COMMENTS);
        if (answer === "CONCERN" && chance(0.5)) comment = pick(CONCERN_COMMENTS);
        if (answer === "YES" && chance(0.03)) {
          tag = "GOOD_PRACTICE";
          comment = pick(GOOD_PRACTICE);
        } else if ((answer === "CONCERN" || answer === "YES") && chance(0.015)) {
          tag = "IMPROVEMENT";
        }
        const answeredMs = createdMs + between(1, 30) * 60_000;
        answers.push({
          id: id("r"),
          assessmentId,
          questionId: question.id,
          moduleId,
          answer,
          comment,
          observationTag: tag,
          photoIds: [],
          questionSnapshot: { text: question.text, weight: question.weight, criticalControl: question.criticalControl },
          createdAt: iso(answeredMs),
          updatedAt: iso(answeredMs),
        });
      }
    }

    const scores = calculateAssessmentScores(
      answers.map((r) => ({ moduleId: r.moduleId, answer: r.answer, weight: r.questionSnapshot.weight })),
      moduleIds,
    );
    const assessment: Assessment = {
      id: assessmentId,
      reference: next("assessment", submittedMs),
      kind,
      moduleIds,
      userId: user.id,
      vesselId: vessel.id,
      locationId,
      auditTypeId: type.id,
      startWork:
        kind === "START_WORK"
          ? { taskDescription: pick(TASKS[moduleIds[0]] ?? ["Routine deck task"]), teamSize: between(2, 8) }
          : null,
      status: "SUBMITTED",
      overallScore: scores.overall,
      moduleScores: scores.byModule,
      snapshot: {
        userName: user.name,
        company: user.company,
        position: user.position,
        vesselName: vessel.name,
        packageId: vessel.packageId,
      },
      createdAt: iso(createdMs),
      updatedAt: iso(submittedMs),
      submittedAt: iso(submittedMs),
    };
    history.assessments.push(assessment);
    history.responses.push(...answers);

    // ---- Positive interventions
    for (const r of answers.filter((x) => x.observationTag === "GOOD_PRACTICE")) {
      history.positiveInterventions.push({
        id: id("p"),
        reference: next("positiveIntervention", submittedMs),
        assessmentId,
        responseId: r.id,
        vesselId: vessel.id,
        moduleId: r.moduleId,
        description: r.comment,
        recordedById: user.id,
        recordedAt: iso(submittedMs),
      });
    }

    // ---- Findings: always for a critical No, often for other Nos, sometimes for a Concern, rarely general
    const raise: { response: Response | null; risk: RiskLevel; description: string }[] = [];
    for (const r of answers) {
      const critical = r.questionSnapshot.criticalControl;
      if (r.answer === "NO" && (critical || chance(0.6))) {
        raise.push({
          response: r,
          risk: critical ? "HIGH" : weighted<RiskLevel>([["LOW", 35], ["MEDIUM", 45], ["HIGH", 20]]),
          description: r.comment ? `${r.questionSnapshot.text} ${r.comment}` : `Not in place: ${r.questionSnapshot.text}`,
        });
      } else if (r.answer === "CONCERN" && chance(0.1)) {
        raise.push({
          response: r,
          risk: weighted<RiskLevel>([["LOW", 60], ["MEDIUM", 40]]),
          description: `Concern: ${r.questionSnapshot.text}${r.comment ? ` ${r.comment}` : ""}`,
        });
      }
    }
    if (chance(0.03)) {
      raise.push({ response: null, risk: "LOW", description: "Housekeeping on the aft deck needs attention." });
    }

    for (const item of raise) {
      const findingId = id("f");
      const reference = next("finding", submittedMs);
      const ageDays = Math.floor((todayMs - submittedMs) / DAY);
      const actions: Action[] = [];
      const actionCount = chance(0.8) ? 1 : 2;
      for (let n = 1; n <= actionCount; n++) {
        const owner = chance(0.6) ? pick(supervisors) : pick(workers);
        const targetMs = submittedMs + TARGET_DAYS[item.risk] * DAY;
        let status: WorkStatus = "OPEN";
        let closedMs: number | null = null;
        if (ageDays >= 3 && chance(Math.min(0.92, 0.25 + ageDays / 60))) {
          status = "CLOSED";
          closedMs = Math.min(todayMs - DAY, submittedMs + between(1, Math.max(1, Math.min(ageDays - 1, TARGET_DAYS[item.risk] + 12))) * DAY);
        } else if (chance(0.35)) {
          status = "IN_PROGRESS";
        }
        actions.push({
          id: id("x"),
          reference: formatActionReference(reference, n),
          findingId,
          description: n === 1 ? item.description : pick(ACTION_TEXT),
          ownerId: owner.id,
          targetDate: lagosDate(targetMs),
          status,
          closureComment: status === "CLOSED" ? "Completed and verified on board." : null,
          closureEvidencePhotoId: null,
          createdById: user.id,
          createdAt: iso(submittedMs),
          closedById: status === "CLOSED" ? owner.id : null,
          closedAt: closedMs === null ? null : iso(closedMs),
        });
      }

      const allClosed = actions.every((a) => a.status === "CLOSED");
      const started = actions.some((a) => a.status !== "OPEN");
      const findingClosedMs = allClosed ? Math.max(...actions.map((a) => Date.parse(a.closedAt!))) : null;
      const finding: Finding = {
        id: findingId,
        reference,
        assessmentId,
        responseId: item.response?.id ?? null,
        vesselId: vessel.id,
        moduleId: item.response?.moduleId ?? (moduleIds.length === 1 ? moduleIds[0] : null),
        description: item.description,
        risk: item.risk,
        critical: item.response?.questionSnapshot.criticalControl ?? false,
        raisedById: user.id,
        raisedAt: iso(submittedMs),
        status: allClosed ? "CLOSED" : started ? "IN_PROGRESS" : "OPEN",
        closureComment: allClosed ? "All actions completed and verified." : null,
        closedById: allClosed ? user.id : null,
        closedAt: findingClosedMs === null ? null : iso(findingClosedMs),
      };
      history.findings.push(finding);
      history.actions.push(...actions);

      const log = (type: FindingActivity["type"], atMs: number, note: string, actionId: ID | null, userId: ID) =>
        history.findingActivities.push({ id: id("l"), findingId, actionId, userId, type, note, at: iso(atMs) });
      log("RAISED", submittedMs, `Raised from ${assessment.reference}`, null, user.id);
      for (const a of actions) {
        log("ACTION_ADDED", submittedMs, `${a.reference} assigned, due ${a.targetDate}`, a.id, user.id);
        if (a.closedAt) log("ACTION_CLOSED", Date.parse(a.closedAt), a.closureComment ?? "", a.id, a.closedById!);
      }
      if (findingClosedMs !== null) log("CLOSED", findingClosedMs, finding.closureComment ?? "", null, user.id);
    }
  }

  return history;
}
