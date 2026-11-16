// MOCK: ~6 months of generated demo history (assessments, answers, findings, actions, activity, positive
// interventions, placeholder photos), so the dashboard tells a story from the first click. Seeded, so every reset
// produces the same data; dates are relative to "today" so the demo always looks current.
// Production: remove (CLAUDE.md §14).
//
// The story, on 8 featured vessels (two per named location):
// - most checks score 75–98%;
// - Dark Knight II is clearly the weakest vessel;
// - Lady Perpetual starts poorly and improves steadily over the six months;
// - on Topaz Master the crew's self-assessments look fine but supervisory audits score much lower (the warning sign
//   the dashboard highlights);
// - a handful of questions (gas testing, permits, toolbox talks, fatigue, drills…) are answered No again and again;
// - ~80 findings in mixed states, some overdue; a few Start Work Checks end in a STOP.

import { joinCodeFrom } from "@/lib/services/join-codes";
import { modulesVisibleTo } from "@/lib/services/permissions";
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
  StartWorkActivity,
  Response,
  RiskLevel,
  User,
  Vessel,
  WorkStatus,
} from "@/lib/types";
import {
  ACTION_TEXT,
  ACTIVITY_CLOSURES,
  CLOSURE_COMMENTS,
  GENERAL_FINDINGS,
  MODULE_CONTENT,
  TASKS,
  YES_NOTES,
} from "./demo-content";
import { demoPhotoId } from "./demo-photos";
import { AUDIT_TYPES, NAMED_LOCATION_IDS } from "./lookups";
import { MODULES } from "./modules";
import { QUESTIONS } from "./questions";
import { USERS } from "./users";
import { FEATURED_VESSELS, VESSELS } from "./vessels";

export interface DemoHistory {
  assessments: Assessment[];
  responses: Response[];
  findings: Finding[];
  actions: Action[];
  findingActivities: FindingActivity[];
  positiveInterventions: PositiveIntervention[];
  startWorkActivities: StartWorkActivity[];
  /** Last used reference number per sequence, e.g. { "VAH-A-2026": 301 }. */
  counters: Record<string, number>;
}

export interface HistoryOptions {
  today?: Date;
  /**
   * Number of check events. Each is one assessment, except a Start Work Check event: an auditor's activity that
   * 1-4 crew members join, each submitting their own check. ~258 events give ~300 assessments.
   */
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

export const STORY = {
  weak: "Dark Knight II",
  improving: "Lady Perpetual",
  gap: "Topaz Master",
} as const;

/** Which company crews which featured vessels (workers mostly assess "their" vessels). Deltaport works fleet-wide. */
const CREWS: Record<string, string[]> = {
  "Harbourline Offshore Services": ["Dark Knight II", "Normand Sentinel"],
  "Coastway Marine": ["Lady Perpetual", "Surfer 2624"],
  "Bluewake Vessel Management": ["Topaz Master", "ACE Discoverer"],
  "Riverbend Marine Logistics": ["Armed Responder XV", "Blue Gretha"],
};

/** Answered No far more often than the rest. */
const PROBLEM_QUESTIONS = new Set([
  "q-hot-work-03", // gas test
  "q-deck-work-03", // permit to work
  "q-deck-work-06", // hazards and controls understood
  "q-galley-02", // food storage temperatures
  "q-occupational-health-03", // fatigue / work-rest hours
  "q-emergency-preparedness-03", // drills current
  "q-learning-action-closure-02", // previous actions closed with evidence
  "q-cargo-operations-06", // lifting equipment certified
  "q-working-at-height-02", // fall protection equipment
  "q-mechanical-lifting-05", // rigging certified and rated
]);

/** How often each Start Work task comes up in the demo: marine work most, onshore-type tasks never. */
const START_WORK_MIX: [moduleId: string, weight: number][] = [
  ["mod-deck-work", 5],
  ["mod-mechanical-lifting", 4],
  ["mod-bunkering", 3],
  ["mod-personnel-transfer", 3],
  ["mod-hot-work", 3],
  ["mod-working-at-height", 3],
  ["mod-energy-isolation", 2],
  ["mod-confined-space-entry", 2],
  ["mod-de-isolation", 1],
  ["mod-energised-electrical", 1],
  ["mod-man-riding", 1],
  ["mod-work-near-water", 1],
  ["mod-mobile-equipment", 1],
];

/** Base answer rates for an average check; multiplied by the vessel/audit "risk factor" below. */
const RATES = { no: 0.0135, problemNo: 0.055, concern: 0.15, startWorkNo: 0.55 } as const;

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
  const { today = new Date(), count = 258, days = 182, seed = 20261106 } = options;
  // The shared stream picks when, where, what and who. Each assessment then draws its answers, comments, photos and
  // findings from its own stream, so tuning one rate (e.g. Start Work Nos) does not reshuffle the whole data set.
  const random = seeded(seed);
  let rng = random;
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)];
  const chance = (p: number) => rng() < p;
  const between = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const weighted = <T>(entries: [T, number][]): T => {
    let roll = rng() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [value, weight] of entries) if ((roll -= weight) < 0) return value;
    return entries[entries.length - 1][0];
  };

  const todayMs = today.getTime();
  const lagosMidnight = Date.parse(`${lagosDate(todayMs)}T00:00:00+01:00`);

  const active = USERS.filter((u) => u.status === "ACTIVE");
  const workers = active.filter((u) => u.role === "WORKER");
  const supervisors = active.filter((u) => u.role === "SUPERVISOR");
  const admins = active.filter((u) => u.role === "ADMIN");
  const vessels = VESSELS.filter((v) => v.status === "ACTIVE" && v.name in FEATURED_VESSELS);
  const named = (name: string) => vessels.find((v) => v.name === name)!.id;
  const weakId = named(STORY.weak);
  const improvingId = named(STORY.improving);
  const gapId = named(STORY.gap);
  const crewFor = (vessel: Vessel) => {
    const company = Object.keys(CREWS).find((c) => CREWS[c].includes(vessel.name));
    return workers.filter((u) => u.company === company || u.company === "Deltaport Crewing");
  };

  const auditType = (code: string) => AUDIT_TYPES.find((t) => t.code === code)!;
  const selfType = auditType("SELF_ASSESSMENT");
  const mfeType = auditType("MFE");
  const startWorkType = auditType("START_WORK_CHECK");
  const workerTypes: [AuditType, number][] = [
    [auditType("LOD1"), 7],
    [auditType("PRE_MOB"), 3],
  ];
  const auditors = active.filter((u) => u.role === "AUDITOR");
  const visitors = active.filter((u) => u.role === "VISITOR");
  /** People who use Self Assessment / MFE. */
  const leaders = [...supervisors, ...auditors, ...visitors];
  const mfeAssessors: [User, number][] = [
    ...supervisors.map((u): [User, number] => [u, 2]),
    ...auditors.map((u): [User, number] => [u, 3]),
    ...visitors.map((u): [User, number] => [u, 1.5]),
    ...admins.map((u): [User, number] => [u, 1]),
  ];
  const namedLocations = NAMED_LOCATION_IDS;
  const actionOwners = [...supervisors, ...auditors];
  const assuranceModules = MODULES.filter((m) => m.active && m.category === "ASSURANCE");
  const startWorkMix = START_WORK_MIX.filter(([moduleId]) => MODULES.some((m) => m.id === moduleId && m.active));

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
    startWorkActivities: [],
    counters: {},
  };
  const next = (kind: "assessment" | "finding" | "positiveIntervention" | "startWorkActivity", ms: number) => {
    const year = referenceYear(new Date(ms));
    const key = sequenceKey(kind, year);
    history.counters[key] = (history.counters[key] ?? 0) + 1;
    return formatReference(kind, year, history.counters[key]);
  };
  let ids = 0;
  const id = (prefix: string) => `hist-${prefix}-${pad(++ids, 6)}`;
  let photos = 0;
  const photo = (moduleId: ID) => demoPhotoId(moduleId, ++photos);

  /** Start Work Checks set up today and still open; the demo worker (Ibrahim) has not joined them yet. */
  interface OpenToday {
    vesselName: string;
    moduleId: ID;
    auditorId: ID;
    teamSize: number;
    joined: number;
    minutesAgo: number;
  }
  const OPEN_TODAY: OpenToday[] = [
    { vesselName: STORY.weak, moduleId: "mod-hot-work", auditorId: "usr-aud-kemi", teamSize: 4, joined: 2, minutesAgo: 95 },
    { vesselName: "Normand Sentinel", moduleId: "mod-working-at-height", auditorId: "usr-aud-musa", teamSize: 3, joined: 0, minutesAgo: 30 },
  ];
  const events: { ms: number; open?: OpenToday }[] = [
    ...moments.map((ms) => ({ ms })),
    ...OPEN_TODAY.map((open) => ({ ms: todayMs - open.minutesAgo * 60_000, open })).sort((a, b) => a.ms - b.ms),
  ];

  /**
   * Start-Work Verifier sign-off: on a closed check the auditor verified everyone before closing; on a check still open
   * today, only the first person has been verified, so both states show in the demo.
   */
  const verificationFor = (activity: StartWorkActivity | null, slotIndex: number, submittedMs: number) => {
    if (!activity) return null;
    const by = { verifiedById: activity.createdById, verifiedByName: activity.snapshot.createdByName };
    if (activity.closedAt) {
      const closedMs = Date.parse(activity.closedAt);
      return { ...by, verifiedAt: iso(Math.max(submittedMs + 60_000, closedMs - (slotIndex + 1) * 3 * 60_000)) };
    }
    return slotIndex === 0 ? { ...by, verifiedAt: iso(submittedMs + 5 * 60_000) } : null;
  };

  for (const [index, { ms: momentMs, open }] of events.entries()) {
    rng = random;
    const progress = Math.min(1, 1 - (lagosMidnight - momentMs) / (days * DAY)); // 0 = oldest, 1 = now

    // ---- Where, what kind of check, by whom
    const vessel = open
      ? vessels.find((v) => v.name === open.vesselName)!
      : weighted(
          vessels.map((v): [Vessel, number] => [v, v.id === weakId ? 1.4 : v.id === gapId ? 1.4 : v.id === improvingId ? 1.5 : 1]),
        );
    const locationId = open || chance(0.9) ? vessel.defaultLocationId : pick(namedLocations);
    const kind: AssessmentKind = open
      ? "START_WORK"
      : weighted([
          ["MODULE", 86],
          ["START_WORK", 9],
          ["FULL_VESSEL", 5],
        ]);

    // Roles pass (2026-11-16): workers use Pre-Mob / LOD 1 on the crew modules; supervisors, auditors and visitors
    // use Self Assessment / MFE (supervisors on the 3 leadership modules only); Full Vessel is for auditors and admins.
    let type: AuditType;
    let user: User;
    if (kind === "START_WORK") {
      type = startWorkType;
      user = chance(0.92) ? pick(crewFor(vessel)) : pick(leaders);
    } else if (kind === "FULL_VESSEL") {
      type = chance(0.8) ? mfeType : selfType;
      user = chance(0.85) ? pick(auditors) : pick(admins);
    } else if (chance(0.5)) {
      type = mfeType;
      user = weighted(mfeAssessors);
    } else if (chance(0.8)) {
      type = weighted(workerTypes);
      user = pick(crewFor(vessel));
    } else {
      type = selfType;
      user = pick(leaders);
    }
    const supervisory = type.assuranceLevel === "SUPERVISORY";

    let moduleIds: ID[];
    if (kind === "FULL_VESSEL") moduleIds = assuranceModules.map((m) => m.id);
    else if (kind === "START_WORK") moduleIds = [open ? open.moduleId : weighted(startWorkMix)];
    else {
      const usable = modulesVisibleTo(user.role, assuranceModules).filter(
        (m) => applicable(m.id, vessel, type.id).length > 0,
      );
      moduleIds = [pick(usable).id];
    }

    // ---- Start Work Check: an auditor sets it up; each crew member who joins submits their own check, minutes apart.
    let slots: { user: User; ms: number }[] = [{ user, ms: momentMs }];
    let activity: StartWorkActivity | null = null;
    if (kind === "START_WORK") {
      const teamSize = open ? open.teamSize : between(2, 4);
      const joined = open ? open.joined : chance(0.85) ? teamSize : Math.max(1, teamSize - 1);
      const pool = crewFor(vessel).filter((u) => !open || u.id !== "usr-wkr-ibrahim");
      const team: User[] = [];
      while (team.length < Math.min(joined, pool.length)) {
        const candidate = pick(pool);
        if (!team.includes(candidate)) team.push(candidate);
      }
      const nextMs = events[index + 1]?.ms ?? todayMs;
      const gap = Math.min(between(2, 5) * 60_000, (nextMs - momentMs) / (team.length + 1));
      slots = team.map((member, p) => ({ user: member, ms: momentMs + p * gap }));
      const auditor = open
        ? active.find((u) => u.id === open.auditorId)!
        : chance(0.9)
          ? pick(auditors)
          : pick(admins);
      const createdMs = momentMs - between(30, 60) * 60_000;
      const lastMs = slots.length > 0 ? slots[slots.length - 1].ms : momentMs;
      const closedMs = open ? null : lastMs + between(15, 90) * 60_000;
      activity = {
        id: id("s"),
        reference: next("startWorkActivity", createdMs),
        code: joinCodeFrom(rng),
        moduleId: moduleIds[0],
        vesselId: vessel.id,
        locationId,
        taskDescription: pick(TASKS[moduleIds[0]] ?? ["Routine deck task"]),
        teamSize,
        createdById: auditor.id,
        status: open ? "OPEN" : "CLOSED",
        closedById: open ? null : auditor.id,
        closedAt: closedMs === null ? null : iso(closedMs),
        closureComment: open ? null : pick(ACTIVITY_CLOSURES),
        snapshot: { vesselName: vessel.name, packageId: vessel.packageId, createdByName: auditor.name },
        createdAt: iso(createdMs),
        updatedAt: iso(closedMs ?? createdMs),
      };
      history.startWorkActivities.push(activity);
    }

    for (const [slotIndex, slot] of slots.entries()) {
      const user = slot.user;
      const submittedMs = slot.ms;
      rng = seeded(seed * 31 + (index + 1) * 7919 + slotIndex * 104_729);

      // ---- Risk factor: how likely No / Concern answers are on this check
      let risk = 1.1 - 0.25 * progress; // the fleet improves a little
      // Supervisors look harder, except on the weak and improving vessels, whose stories are about the vessel itself.
      if (supervisory && vessel.id !== weakId && vessel.id !== improvingId) risk *= 1.3;
      if (vessel.id === weakId) risk *= 5.5;
      if (vessel.id === improvingId) risk *= 5.4 - 5.1 * progress; // poor in May, among the best by November
      if (vessel.id === gapId) risk *= supervisory ? 2.4 : 0.45; // crew rates itself high, supervisors do not
      risk *= 0.7 + rng() * 0.6; // check-to-check variation
      const startWork = kind === "START_WORK";

      const assessmentId = id("a");
      const createdMs = submittedMs - between(8, 45) * 60_000;

      // Pass 1: the answers.
      const planned: { moduleId: ID; question: Question; answer: Answer }[] = [];
      for (const moduleId of moduleIds) {
        for (const question of applicable(moduleId, vessel, type.id)) {
          const problem = PROBLEM_QUESTIONS.has(question.id);
          const pNo = Math.min(0.5, risk * (problem ? RATES.problemNo : RATES.no) * (startWork ? RATES.startWorkNo : 1));
          const pConcern = startWork ? 0 : Math.min(0.5, risk * RATES.concern);
          const pNa = question.criticalControl ? 0.01 : 0.03;
          const roll = rng();
          const answer: Answer = roll < pNo ? "NO" : roll < pNo + pConcern ? "CONCERN" : roll < pNo + pConcern + pNa ? "NA" : "YES";
          planned.push({ moduleId, question, answer });
        }
      }
      // Real audits nearly always note something: a module check with no remarks usually gets one Concern.
      // (Start Work Checks stay Yes / No / N/A, so a clean one scores 100%.)
      if (!startWork && planned.every((p) => p.answer === "YES" || p.answer === "NA") && chance(0.85)) {
        const candidates = planned.filter((p) => p.answer === "YES" && !p.question.criticalControl);
        if (candidates.length > 0) pick(candidates).answer = "CONCERN";
      }

      // Pass 2: comments, tags and photos.
      const answers: Response[] = [];
      for (const { moduleId, question, answer } of planned) {
        {
          const content = MODULE_CONTENT[moduleId];
          let comment = "";
          let tag: ObservationTag | null = null;
          if (answer === "NO" && chance(0.85)) comment = pick(content.no);
          if (answer === "CONCERN" && chance(0.7)) comment = pick(content.concern);
          if (answer === "YES") {
            if (chance(0.036)) {
              tag = "GOOD_PRACTICE";
              comment = pick(content.good);
            } else if (chance(0.04)) {
              comment = pick(YES_NOTES);
            }
          }
          if ((answer === "CONCERN" || answer === "YES") && !tag && chance(0.012)) tag = "IMPROVEMENT";

          // Evidence photos: the rule requires one for No / Concern on evidence-required questions; some Good Practice too.
          const photoIds: ID[] = [];
          if (question.evidenceRequired && (answer === "NO" || answer === "CONCERN")) {
            photoIds.push(photo(moduleId));
            if (chance(0.3)) photoIds.push(photo(moduleId));
          } else if (tag === "GOOD_PRACTICE" && chance(0.35)) {
            photoIds.push(photo(moduleId));
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
            photoIds,
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
        startWork: activity ? { taskDescription: activity.taskDescription, teamSize: activity.teamSize } : null,
        activityId: activity?.id ?? null,
        verification: verificationFor(activity, slotIndex, submittedMs),
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

      // ---- Findings: always (High) for a critical No, often for other Nos, rarely for a Concern or in general
      const raise: { response: Response | null; risk: RiskLevel; description: string }[] = [];
      for (const r of answers) {
        const critical = r.questionSnapshot.criticalControl;
        if (r.answer === "NO" && (critical || chance(0.65))) {
          raise.push({
            response: r,
            risk: critical ? "HIGH" : weighted<RiskLevel>([["LOW", 35], ["MEDIUM", 45], ["HIGH", 20]]),
            description: r.comment ? `${r.questionSnapshot.text} ${r.comment}` : `Not in place: ${r.questionSnapshot.text}`,
          });
        } else if (r.answer === "CONCERN" && chance(0.025)) {
          raise.push({
            response: r,
            risk: weighted<RiskLevel>([["LOW", 60], ["MEDIUM", 40]]),
            description: `Concern: ${r.questionSnapshot.text}${r.comment ? ` ${r.comment}` : ""}`,
          });
        }
      }
      if (!startWork && chance(0.015)) raise.push({ response: null, risk: "LOW", description: pick(GENERAL_FINDINGS) });

      for (const item of raise) {
        const findingId = id("f");
        const reference = next("finding", submittedMs);
        const ageDays = Math.floor((todayMs - submittedMs) / DAY);
        const actions: Action[] = [];
        const actionCount = chance(0.75) ? 1 : 2;
        for (let n = 1; n <= actionCount; n++) {
          const owner = n === 1 && !supervisory && chance(0.5) ? user : chance(0.6) ? pick(actionOwners) : pick(crewFor(vessel));
          const targetMs = submittedMs + TARGET_DAYS[item.risk] * DAY;
          let status: WorkStatus = "OPEN";
          let closedMs: number | null = null;
          if (ageDays >= 3 && chance(Math.min(0.88, 0.08 + ageDays / 55))) {
            status = "CLOSED";
            closedMs = Math.min(todayMs - DAY, submittedMs + between(1, Math.max(1, Math.min(ageDays - 1, TARGET_DAYS[item.risk] + 10))) * DAY);
          } else if (chance(0.4)) {
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
            closureComment: status === "CLOSED" ? pick(CLOSURE_COMMENTS) : null,
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
  }

  return history;
}
