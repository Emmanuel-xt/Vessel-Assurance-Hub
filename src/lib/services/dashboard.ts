// Dashboard aggregation (CLAUDE.md §10).
//
// `loadDashboardData` is the only function that touches repositories. Everything else is a pure function over that
// data, unit-tested, and maps one-to-one onto a database query later (filter = WHERE, scoreBy = GROUP BY + AVG, …).
// Charts only render what these functions return.

import {
  actions,
  assessments,
  auditTypes,
  findings,
  locations,
  modules,
  packages,
  positiveInterventions,
  responses,
  startWorkActivities,
  users,
  vessels,
} from "@/lib/data";
import { addDays } from "@/lib/services/findings";
import { businessToday, isOverdue as isActionOverdue } from "@/lib/services/overdue";
import { PermissionError, canViewDashboard, requireUser, type Principal } from "@/lib/services/permissions";
import { scoreBand, type ScoreBand } from "@/lib/services/scoring";
import type {
  Action,
  Answer,
  Assessment,
  AssuranceLevel,
  AuditType,
  Finding,
  ID,
  ISODate,
  LookupItem,
  Module,
  ModuleCategory,
  PositiveIntervention,
  Response,
  RiskLevel,
  Role,
  StartWorkActivity,
  Vessel,
  WorkStatus,
} from "@/lib/types";

// ---------- Loading ----------

export interface DashboardData {
  /** Submitted assessments only. */
  assessments: Assessment[];
  /** Responses of those assessments. */
  responses: Response[];
  findings: Finding[];
  actions: Action[];
  positiveInterventions: PositiveIntervention[];
  vessels: Vessel[];
  locations: LookupItem[];
  packages: LookupItem[];
  modules: Module[];
  auditTypes: AuditType[];
  /** Start Work Check activities (for the failure trace: reference, who set it up). */
  startWorkActivities: StartWorkActivity[];
  /** Names only (action owners, recorded by); no other user fields reach the page. */
  people: { id: ID; name: string }[];
}

/**
 * Everything the dashboard needs, in one go (supervisors, auditors and admins).
 * MOCK: downloads every submitted assessment, response, finding and action to the browser. Production: server-side
 * aggregation, where each pure function below becomes a database query (WHERE / GROUP BY).
 */
export async function loadDashboardData(actor: Principal): Promise<DashboardData> {
  const user = requireUser(actor);
  if (!canViewDashboard(user)) throw new PermissionError("FORBIDDEN", "Only supervisors, auditors and admins can see the dashboard.");
  const [
    submitted,
    allResponses,
    findingList,
    actionList,
    interventions,
    vesselList,
    locationList,
    packageList,
    moduleList,
    typeList,
    activityList,
    userList,
  ] = await Promise.all([
      assessments.listSubmitted(),
      responses.list(),
      findings.list(),
      actions.list(),
      positiveInterventions.list(),
      vessels.list(),
      locations.list(),
      packages.list(),
      modules.list(),
      auditTypes.list(),
      startWorkActivities.list(),
      users.list(),
    ]);
  const ids = new Set(submitted.map((a) => a.id));
  return {
    assessments: submitted,
    responses: allResponses.filter((r) => ids.has(r.assessmentId)),
    findings: findingList.filter((f) => ids.has(f.assessmentId)),
    actions: actionList,
    positiveInterventions: interventions.filter((p) => ids.has(p.assessmentId)),
    vessels: vesselList,
    locations: locationList,
    packages: packageList,
    modules: moduleList,
    auditTypes: typeList,
    startWorkActivities: activityList,
    people: userList.map((u) => ({ id: u.id, name: u.name })),
  };
}

/** Lookups built once per load so every aggregate is a single pass. */
export interface PreparedData extends DashboardData {
  responsesByAssessment: Map<ID, Response[]>;
  findingsByAssessment: Map<ID, Finding[]>;
  actionsByFinding: Map<ID, Action[]>;
  positiveByAssessment: Map<ID, number>;
  levelByAuditType: Map<ID, AssuranceLevel>;
  names: {
    vessel: Map<ID, string>;
    location: Map<ID, string>;
    package: Map<ID, string>;
    module: Map<ID, string>;
    auditType: Map<ID, string>;
    person: Map<ID, string>;
  };
  moduleById: Map<ID, Module>;
  activityById: Map<ID, StartWorkActivity>;
  /** Lagos submission date per assessment. */
  dateOf: Map<ID, ISODate>;
}

function groupBy<T>(list: T[], key: (item: T) => ID): Map<ID, T[]> {
  const map = new Map<ID, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const nameMap = (list: { id: ID; name: string }[]) => new Map(list.map((x) => [x.id, x.name]));

export function prepareDashboardData(data: DashboardData): PreparedData {
  const positive = new Map<ID, number>();
  for (const p of data.positiveInterventions) positive.set(p.assessmentId, (positive.get(p.assessmentId) ?? 0) + 1);
  return {
    ...data,
    responsesByAssessment: groupBy(data.responses, (r) => r.assessmentId),
    findingsByAssessment: groupBy(data.findings, (f) => f.assessmentId),
    actionsByFinding: groupBy(data.actions, (a) => a.findingId),
    positiveByAssessment: positive,
    levelByAuditType: new Map(data.auditTypes.map((t) => [t.id, t.assuranceLevel])),
    names: {
      vessel: nameMap(data.vessels),
      location: nameMap(data.locations),
      package: nameMap(data.packages),
      module: nameMap(data.modules),
      auditType: nameMap(data.auditTypes),
      person: nameMap(data.people),
    },
    moduleById: new Map(data.modules.map((m) => [m.id, m])),
    activityById: new Map(data.startWorkActivities.map((x) => [x.id, x])),
    dateOf: new Map(data.assessments.map((a) => [a.id, lagosDateOf(a.submittedAt!)])),
  };
}

// ---------- Filter (kept in the URL) ----------

export const DATE_PRESETS = ["last7", "thisMonth", "lastMonth", "thisQuarter", "thisYear", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const PRESET_LABELS: Record<DatePreset, string> = {
  last7: "Last 7 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  thisQuarter: "This quarter",
  thisYear: "This year",
  custom: "Custom",
};

export type Scope = "all" | "self" | "supervisory";

export const SCOPE_LABELS: Record<Scope, string> = { all: "All", self: "Self", supervisory: "Supervisory" };

export interface DashboardFilter {
  preset: DatePreset;
  /** Custom range only (Lagos calendar dates, inclusive). */
  from?: ISODate;
  to?: ISODate;
  vesselId?: ID;
  locationId?: ID;
  moduleId?: ID;
  auditTypeId?: ID;
  packageId?: ID;
  scope: Scope;
  /**
   * The module tiles' own vessel filter. Unset = follow the top-bar vessel; "all" = every vessel even when the top bar
   * has one.
   */
  tileVesselId?: ID;
}

/** `tileVesselId` value for "All vessels". */
export const ALL_VESSELS = "all";

export const DEFAULT_FILTER: DashboardFilter = { preset: "thisYear", scope: "all" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PARAM: Record<"vesselId" | "locationId" | "moduleId" | "auditTypeId" | "packageId", string> = {
  vesselId: "vessel",
  locationId: "location",
  moduleId: "module",
  auditTypeId: "auditType",
  packageId: "package",
};

/** Reads the filter from the URL query string; anything unknown falls back to the default. */
export function parseDashboardFilter(params: URLSearchParams): DashboardFilter {
  const preset = params.get("range") as DatePreset | null;
  const scope = params.get("scope") as Scope | null;
  const date = (key: string) => {
    const value = params.get(key);
    return value && ISO_DATE.test(value) ? value : undefined;
  };
  const filter: DashboardFilter = {
    preset: preset && DATE_PRESETS.includes(preset) ? preset : DEFAULT_FILTER.preset,
    scope: scope && scope in SCOPE_LABELS ? scope : DEFAULT_FILTER.scope,
  };
  if (filter.preset === "custom") {
    filter.from = date("from");
    filter.to = date("to");
  }
  for (const [field, key] of Object.entries(PARAM) as [keyof typeof PARAM, string][]) {
    const value = params.get(key);
    if (value) filter[field] = value;
  }
  const tileVessel = params.get("tileVessel");
  if (tileVessel) filter.tileVesselId = tileVessel;
  return filter;
}

/** The filter as a query string (defaults left out), for bookmarking and sharing. */
export function dashboardQuery(filter: DashboardFilter): string {
  const params = new URLSearchParams();
  if (filter.preset !== DEFAULT_FILTER.preset) params.set("range", filter.preset);
  if (filter.preset === "custom") {
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
  }
  for (const [field, key] of Object.entries(PARAM) as [keyof typeof PARAM, string][]) {
    if (filter[field]) params.set(key, filter[field]!);
  }
  if (filter.scope !== DEFAULT_FILTER.scope) params.set("scope", filter.scope);
  if (filter.tileVesselId) params.set("tileVessel", filter.tileVesselId);
  return params.toString();
}

export interface DrillDown {
  vesselId?: ID;
  locationId?: ID;
  moduleId?: ID;
  packageId?: ID;
  auditTypeId?: ID;
  /** Submitter's company. */
  company?: string;
  /** Assessments that answered No to this question. */
  questionId?: ID;
}

/** Link to the All assessments list with the dashboard's filters (plus a drill-down). */
export function assessmentsLink(filter: DashboardFilter, period: Period, extra: DrillDown = {}): string {
  const params = new URLSearchParams({ view: "all", from: period.from, to: period.to });
  const merged = { ...filter, ...extra };
  if (merged.vesselId) params.set("vessel", merged.vesselId);
  if (merged.locationId) params.set("location", merged.locationId);
  if (merged.moduleId) params.set("module", merged.moduleId);
  if (merged.auditTypeId) params.set("auditType", merged.auditTypeId);
  if (merged.packageId) params.set("package", merged.packageId);
  if (filter.scope !== "all") params.set("scope", filter.scope);
  if (extra.company) params.set("contractor", extra.company);
  if (extra.questionId) params.set("question", extra.questionId);
  return `/assessments?${params.toString()}`;
}

// ---------- Dates ----------

export interface Period {
  from: ISODate;
  to: ISODate;
}

/** Lagos calendar date of a timestamp. Africa/Lagos is UTC+1 all year (no daylight saving). */
export function lagosDateOf(timestamp: string): ISODate {
  return new Date(Date.parse(timestamp) + 3_600_000).toISOString().slice(0, 10);
}

const firstOfMonth = (date: ISODate) => `${date.slice(0, 7)}-01`;

/** Number of days in a period, both ends included. */
export function periodDays(period: Period): number {
  return Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86_400_000) + 1;
}

/** The dates a preset covers, up to today (Lagos). */
export function periodFor(filter: Pick<DashboardFilter, "preset" | "from" | "to">, today: ISODate): Period {
  const [year, month] = today.split("-").map(Number);
  switch (filter.preset) {
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "thisMonth":
      return { from: firstOfMonth(today), to: today };
    case "lastMonth": {
      const end = addDays(firstOfMonth(today), -1);
      return { from: firstOfMonth(end), to: end };
    }
    case "thisQuarter": {
      const quarterMonth = Math.floor((month - 1) / 3) * 3 + 1;
      return { from: `${year}-${String(quarterMonth).padStart(2, "0")}-01`, to: today };
    }
    case "thisYear":
      return { from: `${year}-01-01`, to: today };
    case "custom": {
      const to = filter.to ?? today;
      const from = filter.from ?? addDays(to, -29);
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** The same number of days immediately before. */
export function previousPeriod(period: Period): Period {
  const to = addDays(period.from, -1);
  return { from: addDays(to, -(periodDays(period) - 1)), to };
}

export type Bucket = "week" | "month" | "quarter";

/** Trend grouping: weeks up to ~2 months, months up to a year, quarters beyond. */
export function bucketFor(period: Period): Bucket {
  const days = periodDays(period);
  if (days <= 62) return "week";
  if (days <= 366) return "month";
  return "quarter";
}

/** First day of the week (Monday), month or quarter containing a date. */
export function bucketStart(date: ISODate, bucket: Bucket): ISODate {
  if (bucket === "week") {
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    return addDays(date, -weekday);
  }
  const [year, month] = date.split("-").map(Number);
  const m = bucket === "month" ? month : Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${String(m).padStart(2, "0")}-01`;
}

function nextBucket(start: ISODate, bucket: Bucket): ISODate {
  if (bucket === "week") return addDays(start, 7);
  const [year, month] = start.split("-").map(Number);
  const step = bucket === "month" ? 1 : 3;
  const total = year * 12 + (month - 1) + step;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function bucketLabel(start: ISODate, bucket: Bucket): string {
  const [year, month, day] = start.split("-").map(Number);
  if (bucket === "week") return `${day} ${MONTHS[month - 1]}`;
  if (bucket === "month") return `${MONTHS[month - 1]} ${year}`;
  return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
}

// ---------- Selecting assessments ----------

/** Submitted assessments matching the filter (dimension filters + scope) within a period. */
export function filterAssessments(data: PreparedData, filter: DashboardFilter, period: Period): Assessment[] {
  const wantLevel: AssuranceLevel | null = filter.scope === "self" ? "SELF" : filter.scope === "supervisory" ? "SUPERVISORY" : null;
  return data.assessments.filter((a) => {
    const date = data.dateOf.get(a.id)!;
    return (
      date >= period.from &&
      date <= period.to &&
      (!filter.vesselId || a.vesselId === filter.vesselId) &&
      (!filter.locationId || a.locationId === filter.locationId) &&
      (!filter.packageId || a.snapshot.packageId === filter.packageId) &&
      (!filter.auditTypeId || a.auditTypeId === filter.auditTypeId) &&
      (!filter.moduleId || a.moduleIds.includes(filter.moduleId)) &&
      (!wantLevel || data.levelByAuditType.get(a.auditTypeId) === wantLevel)
    );
  });
}

// ---------- Aggregates ----------

/** Average of the scores that exist, rounded to a whole percent; null when there are none. */
export function averageScore(scores: (number | null)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const s of scores) {
    if (s !== null) {
      sum += s;
      n += 1;
    }
  }
  return n === 0 ? null : Math.round(sum / n);
}

export interface Kpis {
  /** Average overall score of the submitted assessments ("n/a" ones excluded). */
  fleetScore: number | null;
  previousScore: number | null;
  /** Points up or down vs the previous equal period; null if either side has no score. */
  change: number | null;
  submitted: number;
  previousSubmitted: number;
  openFindings: number;
  overdueFindings: number;
  goodPractice: number;
  /** Start Work Checks with at least one No. */
  stopChecks: number;
}

/** Findings of the selected assessments; open = not closed, overdue = any action past its target (§9). */
function findingsOf(data: PreparedData, list: Assessment[]): Finding[] {
  return list.flatMap((a) => data.findingsByAssessment.get(a.id) ?? []);
}

export function isFindingOverdue(data: PreparedData, finding: Finding, today: Date): boolean {
  return finding.status !== "CLOSED" && (data.actionsByFinding.get(finding.id) ?? []).some((a) => isActionOverdue(a, today));
}

export function hasStop(data: PreparedData, assessment: Assessment): boolean {
  return (
    assessment.kind === "START_WORK" && (data.responsesByAssessment.get(assessment.id) ?? []).some((r) => r.answer === "NO")
  );
}

export function kpis(data: PreparedData, current: Assessment[], previous: Assessment[], today: Date): Kpis {
  const fleetScore = averageScore(current.map((a) => a.overallScore));
  const previousScore = averageScore(previous.map((a) => a.overallScore));
  const open = findingsOf(data, current).filter((f) => f.status !== "CLOSED");
  return {
    fleetScore,
    previousScore,
    change: fleetScore !== null && previousScore !== null ? fleetScore - previousScore : null,
    submitted: current.length,
    previousSubmitted: previous.length,
    openFindings: open.length,
    overdueFindings: open.filter((f) => isFindingOverdue(data, f, today)).length,
    goodPractice: current.reduce((n, a) => n + (data.positiveByAssessment.get(a.id) ?? 0), 0),
    stopChecks: current.filter((a) => hasStop(data, a)).length,
  };
}

export interface TrendPoint {
  /** First day of the bucket. */
  key: ISODate;
  label: string;
  score: number | null;
  count: number;
}

/** Average score per week / month / quarter across the whole period (empty buckets included, score null). */
export function trend(data: PreparedData, list: Assessment[], period: Period, bucket: Bucket): TrendPoint[] {
  const byBucket = groupBy(list, (a) => bucketStart(data.dateOf.get(a.id)!, bucket));
  const points: TrendPoint[] = [];
  for (let start = bucketStart(period.from, bucket); start <= period.to; start = nextBucket(start, bucket)) {
    const items = byBucket.get(start) ?? [];
    points.push({ key: start, label: bucketLabel(start, bucket), score: averageScore(items.map((a) => a.overallScore)), count: items.length });
  }
  return points;
}

export interface ScoreRow {
  id: ID;
  name: string;
  score: number | null;
  count: number;
  band: ScoreBand;
}

export type Dimension = "vessel" | "location" | "package" | "auditType" | "contractor";

const DIMENSION_KEY: Record<Dimension, (a: Assessment) => ID> = {
  vessel: (a) => a.vesselId,
  location: (a) => a.locationId,
  package: (a) => a.snapshot.packageId,
  auditType: (a) => a.auditTypeId,
  contractor: (a) => a.snapshot.company,
};

/** Lowest score first (worst at the top), ties by name; groups without a score last. */
const lowestFirst = (a: ScoreRow, b: ScoreRow) =>
  (a.score ?? Infinity) - (b.score ?? Infinity) || a.name.localeCompare(b.name);

/** Average overall score per vessel / location / package / audit type / contractor (submitter's company). */
export function scoreBy(data: PreparedData, list: Assessment[], dimension: Dimension): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const [id, items] of groupBy(list, DIMENSION_KEY[dimension])) {
    const score = averageScore(items.map((a) => a.overallScore));
    const name =
      dimension === "contractor"
        ? id
        : dimension === "vessel"
          ? (data.names.vessel.get(id) ?? items[0].snapshot.vesselName)
          : (data.names[dimension].get(id) ?? "Unknown");
    rows.push({ id, name, score, count: items.length, band: scoreBand(score) });
  }
  return rows.sort(lowestFirst);
}

/** Average module score per module (a Full Vessel assessment counts towards each of its modules). */
export function scoreByModule(data: PreparedData, list: Assessment[]): ScoreRow[] {
  const scores = new Map<ID, (number | null)[]>();
  for (const a of list) {
    for (const moduleId of a.moduleIds) {
      const bucket = scores.get(moduleId) ?? [];
      bucket.push(a.moduleScores[moduleId] ?? null);
      scores.set(moduleId, bucket);
    }
  }
  return [...scores]
    .map(([id, values]) => {
      const score = averageScore(values);
      return { id, name: data.names.module.get(id) ?? "Unknown", score, count: values.length, band: scoreBand(score) };
    })
    .sort(lowestFirst);
}

/** Best first. */
export function contractorRanking(data: PreparedData, list: Assessment[]): ScoreRow[] {
  return scoreBy(data, list, "contractor").sort(
    (a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.name.localeCompare(b.name),
  );
}

/** A self score this many points above the supervisory score is flagged. */
export const GAP_WARNING_POINTS = 15;

export interface SelfVsSupervisoryRow {
  id: ID;
  name: string;
  self: number;
  supervisory: number;
  selfCount: number;
  supervisoryCount: number;
  /** self − supervisory (positive = crews rate themselves higher than supervisors do). */
  gap: number;
  warning: boolean;
}

/** Vessels with both self and supervisory scores in the selection, biggest gap first. */
export function selfVsSupervisory(data: PreparedData, list: Assessment[]): SelfVsSupervisoryRow[] {
  const rows: SelfVsSupervisoryRow[] = [];
  for (const [id, items] of groupBy(list, (a) => a.vesselId)) {
    const self = items.filter((a) => data.levelByAuditType.get(a.auditTypeId) === "SELF");
    const sup = items.filter((a) => data.levelByAuditType.get(a.auditTypeId) === "SUPERVISORY");
    const selfScore = averageScore(self.map((a) => a.overallScore));
    const supScore = averageScore(sup.map((a) => a.overallScore));
    if (selfScore === null || supScore === null) continue;
    const gap = selfScore - supScore;
    rows.push({
      id,
      name: data.names.vessel.get(id) ?? items[0].snapshot.vesselName,
      self: selfScore,
      supervisory: supScore,
      selfCount: self.length,
      supervisoryCount: sup.length,
      gap,
      warning: gap >= GAP_WARNING_POINTS,
    });
  }
  return rows.sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name));
}

export interface NonCompliantQuestion {
  questionId: ID;
  /** Wording as last answered. */
  text: string;
  moduleId: ID;
  moduleName: string;
  /** Number of No answers. */
  count: number;
  critical: boolean;
}

/** The questions answered No most often (No = Non-Compliant on Start Work Checks). */
export function topNonCompliant(data: PreparedData, list: Assessment[], limit = 10): NonCompliantQuestion[] {
  const counts = new Map<ID, NonCompliantQuestion & { lastAt: string }>();
  for (const a of list) {
    for (const r of data.responsesByAssessment.get(a.id) ?? []) {
      if (r.answer !== "NO") continue;
      const entry = counts.get(r.questionId);
      if (entry) {
        entry.count += 1;
        if (r.updatedAt > entry.lastAt) {
          entry.text = r.questionSnapshot.text;
          entry.lastAt = r.updatedAt;
        }
      } else {
        counts.set(r.questionId, {
          questionId: r.questionId,
          text: r.questionSnapshot.text,
          moduleId: r.moduleId,
          moduleName: data.names.module.get(r.moduleId) ?? "Unknown",
          count: 1,
          critical: r.questionSnapshot.criticalControl,
          lastAt: r.updatedAt,
        });
      }
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit)
    .map((q) => ({
      questionId: q.questionId,
      text: q.text,
      moduleId: q.moduleId,
      moduleName: q.moduleName,
      count: q.count,
      critical: q.critical,
    }));
}

export interface FindingsByStatusRow {
  status: WorkStatus;
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  total: number;
}

export const STATUS_ORDER: WorkStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"];
export const RISK_ORDER: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];

/** Findings of the selected assessments: one row per status, counts per risk. */
export function findingsByStatusAndRisk(data: PreparedData, list: Assessment[]): FindingsByStatusRow[] {
  const rows = new Map(STATUS_ORDER.map((status) => [status, { status, LOW: 0, MEDIUM: 0, HIGH: 0, total: 0 }]));
  for (const f of findingsOf(data, list)) {
    const row = rows.get(f.status)!;
    row[f.risk] += 1;
    row.total += 1;
  }
  return [...rows.values()];
}

// ---------- N/A rule ----------
//
// N/A means "this item does not apply here" (the activity is not happening, or the thing does not exist on this
// vessel). It never passes or fails anything: it is left out of every score (scoring.ts) and of every rate below.
// It is still counted on its own (`naShare`) so overuse is visible.

export interface AnswerCounts {
  yes: number;
  concern: number;
  no: number;
  na: number;
  /** Every answer. */
  total: number;
  /** Answers that apply (everything except N/A). */
  applicable: number;
}

export function answerCounts(list: Pick<Response, "answer">[]): AnswerCounts {
  const counts: AnswerCounts = { yes: 0, concern: 0, no: 0, na: 0, total: 0, applicable: 0 };
  for (const r of list) {
    counts.total += 1;
    if (r.answer === "NA") counts.na += 1;
    else {
      counts.applicable += 1;
      if (r.answer === "YES") counts.yes += 1;
      else if (r.answer === "NO") counts.no += 1;
      else counts.concern += 1;
    }
  }
  return counts;
}

/** Whole percent, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

/** No answers as a share of the answers that apply (N/A left out). */
export const noRate = (c: AnswerCounts) => percent(c.no, c.applicable);
/** N/A answers as a share of all answers. */
export const naShare = (c: AnswerCounts) => percent(c.na, c.total);

// ---------- Start Work Check failures ----------

/** A Start Work Check fails (STOP) when any item is answered No. Failure-rate colours: ≤ 10% green, ≤ 25% amber. */
export const FAILURE_BANDS = { green: 10, amber: 25 } as const;

export function failureBand(rate: number | null): ScoreBand {
  if (rate === null) return "none";
  if (rate <= FAILURE_BANDS.green) return "green";
  if (rate <= FAILURE_BANDS.amber) return "amber";
  return "red";
}

export interface FailureRow {
  checks: number;
  /** Checks with at least one No. */
  failed: number;
  /** failed / checks, whole percent. */
  failureRate: number | null;
  band: ScoreBand;
}

export interface StartWorkTaskRow extends FailureRow {
  moduleId: ID;
  name: string;
  /** No answers / answers that apply. */
  noRate: number | null;
  /** N/A answers / all answers. */
  naShare: number | null;
}

export interface StartWorkFailures extends FailureRow {
  /** Highest failure rate first. */
  tasks: StartWorkTaskRow[];
}

const startWorkChecks = (list: Assessment[]) => list.filter((a) => a.kind === "START_WORK");

function failureRow(checks: number, failed: number): FailureRow {
  const failureRate = percent(failed, checks);
  return { checks, failed, failureRate, band: failureBand(failureRate) };
}

const worstFirst = <T extends FailureRow & { name: string }>(a: T, b: T) =>
  (b.failureRate ?? -1) - (a.failureRate ?? -1) || b.failed - a.failed || a.name.localeCompare(b.name);

/** How often each Start Work task stops (any No), with the No and N/A rates behind it. */
export function startWorkFailures(data: PreparedData, list: Assessment[]): StartWorkFailures {
  const checks = startWorkChecks(list);
  const tasks: StartWorkTaskRow[] = [];
  for (const [moduleId, items] of groupBy(checks, (a) => a.moduleIds[0])) {
    const answers = answerCounts(items.flatMap((a) => data.responsesByAssessment.get(a.id) ?? []));
    tasks.push({
      moduleId,
      name: data.names.module.get(moduleId) ?? "Unknown",
      ...failureRow(items.length, items.filter((a) => hasStop(data, a)).length),
      noRate: noRate(answers),
      naShare: naShare(answers),
    });
  }
  return { ...failureRow(checks.length, checks.filter((a) => hasStop(data, a)).length), tasks: tasks.sort(worstFirst) };
}

export interface StartWorkItemRow {
  questionId: ID;
  /** Wording as last answered. */
  text: string;
  critical: boolean;
  yes: number;
  no: number;
  na: number;
  noRate: number | null;
  naShare: number | null;
  /** Failed checks of this task with a No on this item ("caused 7 of 12 STOPs"). */
  stops: number;
  /** stops / failed checks of the task. */
  stopShare: number | null;
}

export interface FailedCheckRow {
  assessmentId: ID;
  reference: string;
  submittedAt: string;
  moduleId: ID;
  moduleName: string;
  vesselId: ID;
  vesselName: string;
  person: string;
  company: string;
  activity: { id: ID; reference: string; createdByName: string } | null;
  /** Items answered No. */
  noItems: string[];
}

export interface VesselFailureRow extends FailureRow {
  id: ID;
  name: string;
}

export interface StartWorkTrace extends FailureRow {
  moduleId: ID;
  name: string;
  /** Every item answered on this task, the ones that stopped work most first. */
  items: StartWorkItemRow[];
  /** Worst vessel first. */
  vessels: VesselFailureRow[];
  /** Newest first, capped. */
  failedChecks: FailedCheckRow[];
}

function failedCheckRow(data: PreparedData, a: Assessment): FailedCheckRow {
  const activity = a.activityId ? data.activityById.get(a.activityId) : undefined;
  const moduleId = a.moduleIds[0];
  return {
    assessmentId: a.id,
    reference: a.reference,
    submittedAt: a.submittedAt!,
    moduleId,
    moduleName: data.names.module.get(moduleId) ?? "Unknown",
    vesselId: a.vesselId,
    vesselName: data.names.vessel.get(a.vesselId) ?? a.snapshot.vesselName,
    person: a.snapshot.userName,
    company: a.snapshot.company,
    activity: activity ? { id: activity.id, reference: activity.reference, createdByName: activity.snapshot.createdByName } : null,
    noItems: (data.responsesByAssessment.get(a.id) ?? []).filter((r) => r.answer === "NO").map((r) => r.questionSnapshot.text),
  };
}

const newestFirst = (a: Assessment, b: Assessment) => b.submittedAt!.localeCompare(a.submittedAt!);

/** Failed Start Work Checks (any task), newest first. */
export function failedStartWorkChecks(data: PreparedData, list: Assessment[], limit = 8): { total: number; rows: FailedCheckRow[] } {
  const failed = startWorkChecks(list).filter((a) => hasStop(data, a)).sort(newestFirst);
  return { total: failed.length, rows: failed.slice(0, limit).map((a) => failedCheckRow(data, a)) };
}

/** Where one task's STOPs come from: which items, which vessels, which checks. */
export function startWorkTrace(data: PreparedData, list: Assessment[], moduleId: ID, limit = 20): StartWorkTrace {
  const checks = startWorkChecks(list).filter((a) => a.moduleIds[0] === moduleId);
  const failed = checks.filter((a) => hasStop(data, a));
  const failedIds = new Set(failed.map((a) => a.id));

  const items = new Map<ID, StartWorkItemRow & { lastAt: string; answers: Response[] }>();
  for (const a of checks) {
    for (const r of data.responsesByAssessment.get(a.id) ?? []) {
      let row = items.get(r.questionId);
      if (!row) {
        row = {
          questionId: r.questionId,
          text: r.questionSnapshot.text,
          critical: r.questionSnapshot.criticalControl,
          yes: 0,
          no: 0,
          na: 0,
          noRate: null,
          naShare: null,
          stops: 0,
          stopShare: null,
          lastAt: r.updatedAt,
          answers: [],
        };
        items.set(r.questionId, row);
      } else if (r.updatedAt > row.lastAt) {
        row.text = r.questionSnapshot.text;
        row.critical = r.questionSnapshot.criticalControl;
        row.lastAt = r.updatedAt;
      }
      row.answers.push(r);
      if (r.answer === "NO" && failedIds.has(a.id)) row.stops += 1;
    }
  }
  const itemRows: StartWorkItemRow[] = [...items.values()]
    .map((row) => {
      const c = answerCounts(row.answers);
      return {
        questionId: row.questionId,
        text: row.text,
        critical: row.critical,
        yes: c.yes,
        no: c.no,
        na: c.na,
        noRate: noRate(c),
        naShare: naShare(c),
        stops: row.stops,
        stopShare: percent(row.stops, failed.length),
      };
    })
    .sort((a, b) => b.stops - a.stops || (b.noRate ?? -1) - (a.noRate ?? -1) || a.questionId.localeCompare(b.questionId));

  const vesselRows: VesselFailureRow[] = [...groupBy(checks, (a) => a.vesselId)]
    .map(([id, group]) => ({
      id,
      name: data.names.vessel.get(id) ?? group[0].snapshot.vesselName,
      ...failureRow(group.length, group.filter((a) => failedIds.has(a.id)).length),
    }))
    .sort(worstFirst);

  return {
    moduleId,
    name: data.names.module.get(moduleId) ?? "Unknown",
    ...failureRow(checks.length, failed.length),
    items: itemRows,
    vessels: vesselRows,
    failedChecks: [...failed].sort(newestFirst).slice(0, limit).map((a) => failedCheckRow(data, a)),
  };
}

// ---------- Auditor follow-up lists ----------

export interface OverdueFindingRow {
  findingId: ID;
  reference: string;
  assessmentId: ID;
  vesselName: string;
  moduleName: string | null;
  description: string;
  risk: RiskLevel;
  critical: boolean;
  /** The most overdue open action. */
  actionReference: string;
  ownerName: string;
  targetDate: ISODate;
  daysOverdue: number;
}

const DAY_MS = 86_400_000;
const daysBetween = (from: ISODate, to: ISODate) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Findings on the selected assessments with an action past its target date, most overdue first. */
export function overdueFindingList(
  data: PreparedData,
  list: Assessment[],
  now: Date,
  limit = 10,
): { total: number; rows: OverdueFindingRow[] } {
  const today = businessToday(now);
  const rows: OverdueFindingRow[] = [];
  for (const f of findingsOf(data, list)) {
    if (f.status === "CLOSED") continue;
    const late = (data.actionsByFinding.get(f.id) ?? [])
      .filter((a) => isActionOverdue(a, now))
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
    if (!late) continue;
    rows.push({
      findingId: f.id,
      reference: f.reference,
      assessmentId: f.assessmentId,
      vesselName: data.names.vessel.get(f.vesselId) ?? "Unknown",
      moduleName: f.moduleId ? (data.names.module.get(f.moduleId) ?? null) : null,
      description: f.description,
      risk: f.risk,
      critical: f.critical,
      actionReference: late.reference,
      ownerName: data.names.person.get(late.ownerId) ?? "Unknown",
      targetDate: late.targetDate,
      daysOverdue: daysBetween(late.targetDate, today),
    });
  }
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue || a.reference.localeCompare(b.reference));
  return { total: rows.length, rows: rows.slice(0, limit) };
}

export interface GoodPracticeRow {
  id: ID;
  reference: string;
  assessmentId: ID;
  vesselName: string;
  moduleName: string | null;
  description: string;
  recordedBy: string;
  recordedAt: string;
}

/** Positive interventions on the selected assessments, newest first. */
export function goodPracticeList(data: PreparedData, list: Assessment[], limit = 8): { total: number; rows: GoodPracticeRow[] } {
  const ids = new Set(list.map((a) => a.id));
  const items = data.positiveInterventions
    .filter((p) => ids.has(p.assessmentId))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.reference.localeCompare(a.reference));
  return {
    total: items.length,
    rows: items.slice(0, limit).map((p) => ({
      id: p.id,
      reference: p.reference,
      assessmentId: p.assessmentId,
      vesselName: data.names.vessel.get(p.vesselId) ?? "Unknown",
      moduleName: p.moduleId ? (data.names.module.get(p.moduleId) ?? null) : null,
      description: p.description,
      recordedBy: data.names.person.get(p.recordedById) ?? "Unknown",
      recordedAt: p.recordedAt,
    })),
  };
}

// ---------- Module tiles ----------

export interface ModuleTile extends ScoreRow {
  category: ModuleCategory;
  displayOrder: number;
  /** Start Work tasks only: share of checks stopped. */
  failureRate: number | null;
  failureBand: ScoreBand;
}

export interface ModuleTiles {
  /** Lowest score first. */
  assurance: ModuleTile[];
  startWork: ModuleTile[];
  /** Active modules with no assessment in the selection. */
  withoutData: { assurance: number; startWork: number };
  /** The vessel the tiles show (null = every vessel). */
  vesselId: ID | null;
}

/** The vessel the tiles use: their own choice, else the top-bar vessel. */
export function tileVesselOf(filter: DashboardFilter): ID | null {
  if (filter.tileVesselId === ALL_VESSELS) return null;
  return filter.tileVesselId ?? filter.vesselId ?? null;
}

/**
 * Score per module as tiles. They keep the dashboard's date, scope, location, package and audit type filters but not its
 * module filter (so every module stays visible) and use their own vessel filter.
 */
export function moduleTiles(data: PreparedData, filter: DashboardFilter, period: Period): ModuleTiles {
  const vesselId = tileVesselOf(filter);
  const list = filterAssessments(data, { ...filter, moduleId: undefined, vesselId: vesselId ?? undefined }, period);
  const failures = new Map(startWorkFailures(data, list).tasks.map((t) => [t.moduleId, t]));
  const tiles = scoreByModule(data, list).map((row): ModuleTile => {
    const mod = data.moduleById.get(row.id);
    const failureRate = failures.get(row.id)?.failureRate ?? null;
    return {
      ...row,
      category: mod?.category ?? "ASSURANCE",
      displayOrder: mod?.displayOrder ?? Number.MAX_SAFE_INTEGER,
      failureRate,
      failureBand: failureBand(failureRate),
    };
  });
  const shown = new Set(tiles.map((t) => t.id));
  const missing = (category: ModuleCategory) =>
    data.modules.filter((m) => m.active && m.category === category && !shown.has(m.id)).length;
  return {
    assurance: tiles.filter((t) => t.category === "ASSURANCE"),
    startWork: tiles.filter((t) => t.category === "START_WORK"),
    withoutData: { assurance: missing("ASSURANCE"), startWork: missing("START_WORK") },
    vesselId,
  };
}

// ---------- What each role sees ----------

export type KpiKey = "fleetScore" | "submitted" | "openFindings" | "overdueFindings" | "goodPractice" | "stopChecks";

export interface DashboardLayout {
  role: "ADMIN" | "AUDITOR" | "SUPERVISOR";
  /** Headline cards, in order. */
  cards: KpiKey[];
  /** Auditor: lists behind the overdue / STOP / Good Practice cards. */
  followUp: boolean;
  /** Start Work Check failure trace. */
  startWork: boolean;
  /** Fleet-management breakdowns (location, package, contractor). */
  fleetBreakdowns: boolean;
}

/**
 * Admin: everything. Auditor: follow-up first (overdue findings, STOPs, Good Practice) and the Start Work failure trace.
 * Supervisor: the fleet view without the follow-up cards.
 */
export function dashboardLayoutFor(role: Role): DashboardLayout {
  if (role === "ADMIN") {
    return {
      role,
      cards: ["fleetScore", "submitted", "openFindings", "overdueFindings", "goodPractice", "stopChecks"],
      followUp: false,
      startWork: true,
      fleetBreakdowns: true,
    };
  }
  if (role === "AUDITOR") {
    return { role, cards: ["overdueFindings", "stopChecks", "goodPractice"], followUp: true, startWork: true, fleetBreakdowns: false };
  }
  return { role: "SUPERVISOR", cards: ["fleetScore", "submitted", "openFindings"], followUp: false, startWork: false, fleetBreakdowns: true };
}

// ---------- Everything for one filter ----------

export interface DashboardView {
  period: Period;
  previous: Period;
  bucket: Bucket;
  assessments: Assessment[];
  kpis: Kpis;
  trend: TrendPoint[];
  byVessel: ScoreRow[];
  byLocation: ScoreRow[];
  byPackage: ScoreRow[];
  byModule: ScoreRow[];
  contractors: ScoreRow[];
  selfVsSupervisory: SelfVsSupervisoryRow[];
  topNonCompliant: NonCompliantQuestion[];
  findings: FindingsByStatusRow[];
  startWork: StartWorkFailures;
  tiles: ModuleTiles;
  followUp: {
    overdue: { total: number; rows: OverdueFindingRow[] };
    stops: { total: number; rows: FailedCheckRow[] };
    goodPractice: { total: number; rows: GoodPracticeRow[] };
  };
}

export function computeDashboard(data: PreparedData, filter: DashboardFilter, now: Date = new Date()): DashboardView {
  const today = lagosDateOf(now.toISOString());
  const period = periodFor(filter, today);
  const previous = previousPeriod(period);
  const bucket = bucketFor(period);
  const current = filterAssessments(data, filter, period);
  const before = filterAssessments(data, filter, previous);
  return {
    period,
    previous,
    bucket,
    assessments: current,
    kpis: kpis(data, current, before, now),
    trend: trend(data, current, period, bucket),
    byVessel: scoreBy(data, current, "vessel"),
    byLocation: scoreBy(data, current, "location"),
    byPackage: scoreBy(data, current, "package"),
    byModule: scoreByModule(data, current),
    contractors: contractorRanking(data, current),
    selfVsSupervisory: selfVsSupervisory(data, current),
    topNonCompliant: topNonCompliant(data, current),
    findings: findingsByStatusAndRisk(data, current),
    startWork: startWorkFailures(data, current),
    tiles: moduleTiles(data, filter, period),
    followUp: {
      overdue: overdueFindingList(data, current, now),
      stops: failedStartWorkChecks(data, current),
      goodPractice: goodPracticeList(data, current),
    },
  };
}

// ---------- Excel export rows ----------

type Cell = string | number;
export type SheetRows = Record<string, Cell>[];

const ANSWER_TEXT: Record<Answer, string> = { YES: "Yes", CONCERN: "Concern Identified", NO: "No", NA: "N/A" };
const STATUS_TEXT: Record<WorkStatus, string> = { OPEN: "Open", IN_PROGRESS: "In progress", CLOSED: "Closed" };
const RISK_TEXT: Record<RiskLevel, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

/** "2026-11-05 14:30" in Lagos time. */
export function lagosDateTime(timestamp: string): string {
  return new Date(Date.parse(timestamp) + 3_600_000).toISOString().slice(0, 16).replace("T", " ");
}

/** Rows for the four sheets (Assessments, Responses, Findings, Start Work) of the filtered assessments. */
export function exportRows(data: PreparedData, list: Assessment[], now: Date = new Date()) {
  const kind = { MODULE: "Module", FULL_VESSEL: "Full Vessel Assurance", START_WORK: "Start Work Check" } as const;
  const ref = new Map(list.map((a) => [a.id, a.reference]));

  const assessmentRows: SheetRows = list.map((a) => ({
    Reference: a.reference,
    Submitted: lagosDateTime(a.submittedAt!),
    Type: kind[a.kind],
    Modules: a.moduleIds.map((m) => data.names.module.get(m) ?? m).join(", "),
    Vessel: a.snapshot.vesselName,
    Package: data.names.package.get(a.snapshot.packageId) ?? "",
    Location: data.names.location.get(a.locationId) ?? "",
    "Audit type": data.names.auditType.get(a.auditTypeId) ?? "",
    "Self / Supervisory": data.levelByAuditType.get(a.auditTypeId) === "SUPERVISORY" ? "Supervisory" : "Self",
    "Assessed by": a.snapshot.userName,
    Position: a.snapshot.position,
    Company: a.snapshot.company,
    Job: a.startWork?.taskDescription ?? "",
    "Team size": a.startWork?.teamSize ?? "",
    "Score %": a.overallScore ?? "",
    "No answers": (data.responsesByAssessment.get(a.id) ?? []).filter((r) => r.answer === "NO").length,
    Findings: (data.findingsByAssessment.get(a.id) ?? []).length,
  }));

  const responseRows: SheetRows = list.flatMap((a) =>
    (data.responsesByAssessment.get(a.id) ?? []).map((r) => ({
      Assessment: a.reference,
      Vessel: a.snapshot.vesselName,
      Module: data.names.module.get(r.moduleId) ?? "",
      Question: r.questionSnapshot.text,
      Critical: r.questionSnapshot.criticalControl ? "Yes" : "No",
      Weight: r.questionSnapshot.weight,
      Answer: a.kind === "START_WORK" && r.answer !== "NA" ? (r.answer === "YES" ? "Compliant" : "Non-Compliant") : ANSWER_TEXT[r.answer],
      Comment: r.comment,
      Tag: r.observationTag === "GOOD_PRACTICE" ? "Good Practice" : r.observationTag === "IMPROVEMENT" ? "Improvement Opportunity" : "",
      Photos: r.photoIds.length,
    })),
  );

  const findingRows: SheetRows = findingsOf(data, list).map((f) => {
    const acts = data.actionsByFinding.get(f.id) ?? [];
    const open = acts.filter((x) => x.status !== "CLOSED");
    const nextDue = open.map((x) => x.targetDate).sort()[0] ?? "";
    return {
      Reference: f.reference,
      Assessment: ref.get(f.assessmentId) ?? "",
      Vessel: data.names.vessel.get(f.vesselId) ?? "",
      Module: f.moduleId ? (data.names.module.get(f.moduleId) ?? "") : "",
      Description: f.description,
      Risk: RISK_TEXT[f.risk],
      Critical: f.critical ? "Yes" : "No",
      Status: STATUS_TEXT[f.status],
      Raised: lagosDateTime(f.raisedAt),
      Actions: acts.length,
      "Open actions": open.length,
      Overdue: isFindingOverdue(data, f, now) ? "Yes" : "No",
      "Next due": nextDue,
      Closed: f.closedAt ? lagosDateTime(f.closedAt) : "",
    };
  });

  const pct = (v: number | null) => v ?? "";
  const startWorkRows: SheetRows = startWorkFailures(data, list).tasks.map((t) => ({
    Task: t.name,
    Checks: t.checks,
    "Stopped (any No)": t.failed,
    "Stopped %": pct(t.failureRate),
    "No % (N/A left out)": pct(t.noRate),
    "N/A % of answers": pct(t.naShare),
  }));

  return { Assessments: assessmentRows, Responses: responseRows, Findings: findingRows, "Start Work": startWorkRows };
}
