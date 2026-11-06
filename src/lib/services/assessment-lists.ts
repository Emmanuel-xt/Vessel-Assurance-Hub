// Assessment lists (My / All) and the read-only assessment detail.

import {
  assessments,
  auditTypes,
  findings,
  locations,
  modules,
  packages,
  positiveInterventions,
  questions,
  responses,
  users,
  vessels,
} from "@/lib/data";
import { getAssessmentForUser, requireEditableDraft } from "@/lib/services/assessment-access";
import { KIND_LABELS, listMyAssessments, loadAssessmentForm } from "@/lib/services/assessments";
import { ValidationError } from "@/lib/services/errors";
import { listAssessmentFindings, type RaisedFinding } from "@/lib/services/findings";
import { PermissionError, canEditAssessment, canViewDashboard, requireUser, type Principal } from "@/lib/services/permissions";
import type { Assessment, ID, ISODate, ISODateTime, Module, Response } from "@/lib/types";

// ---------- Rows ----------

export interface AssessmentRow {
  assessment: Assessment;
  /** Module name (single module), or "Full Vessel Assurance" / "Start Work Check". */
  title: string;
  /** Start Work: the task module; Full Vessel: "12 modules". */
  subtitle: string | null;
  auditTypeName: string;
  locationName: string;
  /** Findings on this assessment that are not closed. */
  openFindings: number;
}

type Named = { id: ID; name: string };
const nameIn = (list: Named[], id: ID) => list.find((x) => x.id === id)?.name ?? "Unknown";

async function toRows(list: Assessment[]): Promise<AssessmentRow[]> {
  if (list.length === 0) return [];
  const [moduleList, auditTypeList, locationList, findingList] = await Promise.all([
    modules.list(),
    auditTypes.list(),
    locations.list(),
    findings.list(),
  ]);
  return list.map((assessment) => {
    const firstModule = nameIn(moduleList, assessment.moduleIds[0]);
    return {
      assessment,
      title: assessment.kind === "MODULE" ? firstModule : KIND_LABELS[assessment.kind],
      subtitle:
        assessment.kind === "START_WORK"
          ? firstModule
          : assessment.kind === "FULL_VESSEL"
            ? `${assessment.moduleIds.length} modules`
            : null,
      auditTypeName: nameIn(auditTypeList, assessment.auditTypeId),
      locationName: nameIn(locationList, assessment.locationId),
      openFindings: findingList.filter((f) => f.assessmentId === assessment.id && f.status !== "CLOSED").length,
    };
  });
}

/** The actor's drafts (most recently edited first) and submitted assessments (newest first). */
export async function listMyAssessmentRows(actor: Principal): Promise<{ drafts: AssessmentRow[]; submitted: AssessmentRow[] }> {
  const rows = await toRows(await listMyAssessments(actor));
  return {
    drafts: rows.filter((r) => r.assessment.status === "DRAFT"),
    submitted: rows.filter((r) => r.assessment.status === "SUBMITTED"),
  };
}

// ---------- All assessments (supervisors and admins) ----------

export interface AllAssessmentsFilter {
  vesselId?: ID;
  locationId?: ID;
  moduleId?: ID;
  auditTypeId?: ID;
  packageId?: ID;
  /** Submitter's company (contractor). */
  company?: string;
  /** Self = Self Assessment / Start Work Check; Supervisory = MFE / Spot Check / Verification (audit type's level). */
  scope?: "self" | "supervisory";
  /** Only assessments that answered No to this question (dashboard drill-down). */
  questionId?: ID;
  userId?: ID;
  /** Calendar dates in Lagos, inclusive. */
  from?: ISODate;
  to?: ISODate;
}

export const canViewAllAssessments = canViewDashboard;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Start of a Lagos calendar day as an ISO timestamp. Lagos is UTC+1 all year (no daylight saving). */
export function lagosDayStart(date: ISODate): ISODateTime {
  return new Date(`${date}T00:00:00.000+01:00`).toISOString();
}

/** Last millisecond of a Lagos calendar day as an ISO timestamp. */
export function lagosDayEnd(date: ISODate): ISODateTime {
  return new Date(`${date}T23:59:59.999+01:00`).toISOString();
}

/** Submitted assessments across the fleet, newest first. Drafts are private and never listed here. */
export async function listAllAssessmentRows(actor: Principal, filter: AllAssessmentsFilter = {}): Promise<AssessmentRow[]> {
  const user = requireUser(actor);
  if (!canViewAllAssessments(user)) {
    throw new PermissionError("FORBIDDEN", "Only supervisors and admins can see all assessments.");
  }
  for (const key of ["from", "to"] as const) {
    if (filter[key] && !ISO_DATE.test(filter[key]!)) {
      throw new ValidationError("Please fix the highlighted fields.", { [key]: "Enter a valid date" });
    }
  }
  if (filter.from && filter.to && filter.from > filter.to) {
    throw new ValidationError("Please fix the highlighted fields.", { to: "The end date is before the start date" });
  }
  let auditTypeIds = filter.auditTypeId ? [filter.auditTypeId] : undefined;
  if (filter.scope) {
    const level = filter.scope === "self" ? "SELF" : "SUPERVISORY";
    const ofLevel = (await auditTypes.list()).filter((t) => t.assuranceLevel === level).map((t) => t.id);
    auditTypeIds = auditTypeIds ? auditTypeIds.filter((id) => ofLevel.includes(id)) : ofLevel;
    if (auditTypeIds.length === 0) return [];
  }
  let list = await assessments.listSubmitted({
    vesselIds: filter.vesselId ? [filter.vesselId] : undefined,
    locationIds: filter.locationId ? [filter.locationId] : undefined,
    packageIds: filter.packageId ? [filter.packageId] : undefined,
    companies: filter.company ? [filter.company] : undefined,
    moduleId: filter.moduleId || undefined,
    auditTypeIds,
    userId: filter.userId || undefined,
    from: filter.from ? lagosDayStart(filter.from) : undefined,
    to: filter.to ? lagosDayEnd(filter.to) : undefined,
  });
  if (filter.questionId) {
    const answeredNo = new Set(
      (await responses.list())
        .filter((r) => r.questionId === filter.questionId && r.answer === "NO")
        .map((r) => r.assessmentId),
    );
    list = list.filter((a) => answeredNo.has(a.id));
  }
  return toRows(list);
}

export interface FilterOptions {
  vessels: Named[];
  locations: Named[];
  modules: Named[];
  auditTypes: Named[];
  packages: Named[];
  /** Companies of everyone who has submitted (contractors). */
  companies: string[];
  /** Everyone who has an account that was ever active (pending sign-ups excluded). */
  users: (Named & { company: string })[];
}

/** Choices for the All assessments filters, by name. Inactive items are kept so history can still be filtered. */
export async function loadFilterOptions(actor: Principal): Promise<FilterOptions> {
  const user = requireUser(actor);
  if (!canViewAllAssessments(user)) throw new PermissionError("FORBIDDEN", "Only supervisors and admins can filter all assessments.");
  const [vesselList, locationList, moduleList, auditTypeList, packageList, userList] = await Promise.all([
    vessels.list(),
    locations.list(),
    modules.list(),
    auditTypes.list(),
    packages.list(),
    users.list(),
  ]);
  const byName = <T extends Named>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));
  const pick = (list: Named[]) => byName(list.map(({ id, name }) => ({ id, name })));
  return {
    vessels: pick(vesselList),
    locations: pick(locationList),
    modules: [...moduleList].sort((a, b) => a.displayOrder - b.displayOrder).map(({ id, name }) => ({ id, name })),
    auditTypes: pick(auditTypeList),
    packages: pick(packageList),
    companies: [...new Set(userList.filter((u) => u.status !== "PENDING").map((u) => u.company))].sort(),
    users: byName(
      userList.filter((u) => u.status !== "PENDING").map(({ id, name, company }) => ({ id, name, company })),
    ),
  };
}

// ---------- Drafts ----------

/** Deletes one of the actor's own drafts, with its answers, photos and prepared findings. */
export async function deleteMyDraft(actor: Principal, assessmentId: ID): Promise<void> {
  await requireEditableDraft(actor, assessmentId);
  await assessments.removeDraft(assessmentId);
}

// ---------- Detail ----------

export interface DetailItem {
  questionId: ID;
  number: number;
  text: string;
  criticalControl: boolean;
  response: Response | null;
}

export interface DetailSection {
  module: Module;
  items: DetailItem[];
}

export interface AssessmentDetail {
  assessment: Assessment;
  title: string;
  /** Start Work task module name. */
  subtitle: string | null;
  sections: DetailSection[];
  packageName: string;
  locationName: string;
  auditTypeName: string;
  findings: RaisedFinding[];
  positiveInterventionCount: number;
  /** The actor's own draft: offer "Continue" to the form. */
  editable: boolean;
}

/**
 * Everything the read-only page shows. Submitted assessments are rebuilt from their answers (question text, weight and
 * critical flag as they were when answered), so later changes to the question bank never change the record.
 * Drafts (visible to their owner and admins) show the questions that apply now.
 */
export async function loadAssessmentDetail(actor: Principal, id: ID): Promise<AssessmentDetail> {
  const assessment = await getAssessmentForUser(actor, id);
  const [moduleList, packageList, locationList, auditTypeList, findingList, interventions] = await Promise.all([
    modules.list(),
    packages.list(),
    locations.list(),
    auditTypes.list(),
    assessment.status === "SUBMITTED" ? listAssessmentFindings(actor, id) : Promise.resolve([]),
    positiveInterventions.list({ assessmentId: id }),
  ]);
  const moduleOf = (moduleId: ID) => moduleList.find((m) => m.id === moduleId);

  let sections: DetailSection[];
  if (assessment.status === "SUBMITTED") {
    const [saved, bank] = await Promise.all([responses.listByAssessment(id), questions.list()]);
    const order = new Map(bank.map((q) => [q.id, q.displayOrder]));
    let number = 0;
    sections = assessment.moduleIds.flatMap((moduleId) => {
      const sectionModule = moduleOf(moduleId);
      if (!sectionModule) return [];
      const items = saved
        .filter((r) => r.moduleId === moduleId)
        .sort(
          (a, b) =>
            (order.get(a.questionId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.questionId) ?? Number.MAX_SAFE_INTEGER) ||
            a.createdAt.localeCompare(b.createdAt),
        )
        .map((response) => ({
          questionId: response.questionId,
          number: ++number,
          text: response.questionSnapshot.text,
          criticalControl: response.questionSnapshot.criticalControl,
          response,
        }));
      return [{ module: sectionModule, items }];
    });
  } else {
    const form = await loadAssessmentForm(actor, id);
    let number = 0;
    sections = form.sections.map((section) => ({
      module: section.module,
      items: section.questions.map((q) => ({
        questionId: q.id,
        number: ++number,
        text: q.text,
        criticalControl: q.criticalControl,
        response: form.responses[q.id] ?? null,
      })),
    }));
  }

  const firstModule = moduleOf(assessment.moduleIds[0])?.name ?? "Unknown module";
  return {
    assessment,
    title: assessment.kind === "MODULE" ? firstModule : KIND_LABELS[assessment.kind],
    subtitle: assessment.kind === "START_WORK" ? firstModule : null,
    sections,
    packageName: nameIn(packageList, assessment.snapshot.packageId),
    locationName: nameIn(locationList, assessment.locationId),
    auditTypeName: nameIn(auditTypeList, assessment.auditTypeId),
    findings: findingList,
    positiveInterventionCount: interventions.length,
    editable: canEditAssessment(requireUser(actor), assessment),
  };
}
