// MOCK: findings, actions, the finding activity log, positive interventions and notifications.

import {
  RepositoryError,
  type ActionCreateInput,
  type ActionFilter,
  type ActionPatch,
  type ActionsRepository,
  type FindingActivitiesRepository,
  type FindingCreateInput,
  type FindingDraftsRepository,
  type FindingFilter,
  type FindingPatch,
  type FindingsRepository,
  type NotificationsRepository,
  type PositiveInterventionCreateInput,
  type PositiveInterventionFilter,
  type PositiveInterventionsRepository,
} from "@/lib/data/repositories";
import { formatActionReference, formatReference, referenceYear, sequenceKey, type ReferenceKind } from "@/lib/services/references";
import type { Assessment, ID } from "@/lib/types";
import { crud, requireRow, rows } from "./crud";
import { db, nextSequence, persist } from "./store";
import { clone, definedOnly, newId, nowIso, simulateLatency } from "./utils";

function nextReference(kind: ReferenceKind): string {
  const year = referenceYear(new Date());
  return formatReference(kind, year, nextSequence(sequenceKey(kind, year)));
}

/** Findings and positive interventions are recorded against submitted assessments only. */
function requireSubmitted(assessmentId: ID): Assessment {
  const assessment = requireRow("assessments", assessmentId, "Assessment");
  if (assessment.status !== "SUBMITTED") {
    throw new RepositoryError("CONFLICT", "Submit the assessment before recording findings or positive interventions");
  }
  return assessment;
}

/** Module of the linked response, or the assessment's only module. */
function resolveModuleId(assessment: Assessment, responseId: ID | null): ID | null {
  if (responseId) {
    const response = requireRow("responses", responseId, "Response");
    if (response.assessmentId !== assessment.id) {
      throw new RepositoryError("VALIDATION", "The response belongs to a different assessment");
    }
    return response.moduleId;
  }
  return assessment.moduleIds.length === 1 ? assessment.moduleIds[0] : null;
}

// ---------- Findings ----------

export const findings: FindingsRepository = crud<"findings", FindingCreateInput, FindingFilter, FindingPatch>("findings", {
  entity: "Finding",
  build: (input) => {
    const assessment = requireSubmitted(input.assessmentId);
    requireRow("users", input.raisedById, "User");
    return {
      ...input,
      id: newId(),
      reference: nextReference("finding"),
      vesselId: assessment.vesselId,
      moduleId: resolveModuleId(assessment, input.responseId),
      raisedAt: nowIso(),
      status: "OPEN",
      closureComment: null,
      closedById: null,
      closedAt: null,
    };
  },
  matches: (x, f) =>
    (!f.status || x.status === f.status) &&
    (!f.assessmentId || x.assessmentId === f.assessmentId) &&
    (!f.vesselId || x.vesselId === f.vesselId) &&
    (!f.risk || x.risk === f.risk) &&
    (!f.raisedById || x.raisedById === f.raisedById),
  compare: (a, b) => b.raisedAt.localeCompare(a.raisedAt),
});

// ---------- Actions ----------

export const actions: ActionsRepository = crud<"actions", ActionCreateInput, ActionFilter, ActionPatch>("actions", {
  entity: "Action",
  build: (input) => {
    const finding = requireRow("findings", input.findingId, "Finding");
    requireRow("users", input.ownerId, "User");
    // Actions are never deleted, so the count gives the next number.
    const actionNumber = rows("actions").filter((a) => a.findingId === finding.id).length + 1;
    return {
      ...input,
      id: newId(),
      reference: formatActionReference(finding.reference, actionNumber),
      status: "OPEN",
      closureComment: null,
      closureEvidencePhotoId: null,
      createdAt: nowIso(),
      closedById: null,
      closedAt: null,
    };
  },
  matches: (a, f) =>
    (!f.findingId || a.findingId === f.findingId) &&
    (!f.ownerId || a.ownerId === f.ownerId) &&
    (!f.status || a.status === f.status),
  compare: (a, b) => a.targetDate.localeCompare(b.targetDate) || a.reference.localeCompare(b.reference),
  beforeUpdate: (_row, patch) => {
    if (patch.ownerId !== undefined) requireRow("users", patch.ownerId, "User");
  },
});

// ---------- Finding activity (append-only) ----------

export const findingActivities: FindingActivitiesRepository = {
  async listByFinding(findingId) {
    await simulateLatency();
    return clone(rows("findingActivities").filter((x) => x.findingId === findingId).sort((a, b) => a.at.localeCompare(b.at)));
  },
  async create(input) {
    await simulateLatency();
    requireRow("findings", input.findingId, "Finding");
    const activity = { ...input, id: newId(), at: nowIso() };
    rows("findingActivities").push(activity);
    persist();
    return clone(activity);
  },
};

// ---------- Findings prepared on drafts ----------

export const findingDrafts: FindingDraftsRepository = {
  async listByAssessment(assessmentId) {
    await simulateLatency();
    return clone(
      rows("findingDrafts")
        .filter((d) => d.assessmentId === assessmentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  },
  async get(id) {
    await simulateLatency();
    const row = rows("findingDrafts").find((d) => d.id === id);
    return row ? clone(row) : null;
  },
  async create(input) {
    await simulateLatency();
    const assessment = requireRow("assessments", input.assessmentId, "Assessment");
    if (assessment.status !== "DRAFT") {
      throw new RepositoryError("CONFLICT", "Findings can only be prepared on a draft assessment");
    }
    requireRow("users", input.ownerId, "User");
    const now = nowIso();
    const row = { ...input, id: newId(), createdAt: now, updatedAt: now };
    rows("findingDrafts").push(row);
    persist();
    return clone(row);
  },
  async update(id, patch) {
    await simulateLatency();
    const row = requireRow("findingDrafts", id, "Finding draft");
    if (patch.ownerId !== undefined) requireRow("users", patch.ownerId, "User");
    Object.assign(row, definedOnly(patch), { updatedAt: nowIso() });
    persist();
    return clone(row);
  },
  async remove(id) {
    await simulateLatency();
    const data = db();
    data.findingDrafts = data.findingDrafts.filter((d) => d.id !== id);
    persist();
  },
};

// ---------- Positive interventions ----------

export const positiveInterventions: PositiveInterventionsRepository = crud<
  "positiveInterventions",
  PositiveInterventionCreateInput,
  PositiveInterventionFilter
>("positiveInterventions", {
  entity: "Positive intervention",
  build: (input) => {
    const assessment = requireSubmitted(input.assessmentId);
    return {
      ...input,
      id: newId(),
      reference: nextReference("positiveIntervention"),
      vesselId: assessment.vesselId,
      moduleId: resolveModuleId(assessment, input.responseId),
      recordedAt: nowIso(),
    };
  },
  matches: (p, f) =>
    (!f.assessmentId || p.assessmentId === f.assessmentId) &&
    (!f.vesselId || p.vesselId === f.vesselId) &&
    (!f.from || p.recordedAt >= f.from) &&
    (!f.to || p.recordedAt <= f.to),
  compare: (a, b) => b.recordedAt.localeCompare(a.recordedAt),
});

// ---------- Notifications ----------

export const notifications: NotificationsRepository = {
  async listForUser(userId, options = {}) {
    await simulateLatency();
    const list = rows("notifications")
      .filter((n) => n.userId === userId && (!options.unreadOnly || n.readAt === null))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return clone(list);
  },
  async create(input) {
    await simulateLatency();
    const notification = { ...input, id: newId(), readAt: null, createdAt: nowIso() };
    rows("notifications").push(notification);
    persist();
    return clone(notification);
  },
  async markRead(id) {
    await simulateLatency();
    const notification = requireRow("notifications", id, "Notification");
    notification.readAt ??= nowIso();
    persist();
    return clone(notification);
  },
  async markAllRead(userId) {
    await simulateLatency();
    const now = nowIso();
    for (const n of rows("notifications")) {
      if (n.userId === userId && n.readAt === null) n.readAt = now;
    }
    persist();
  },
};
