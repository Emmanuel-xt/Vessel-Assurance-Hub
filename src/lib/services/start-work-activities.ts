// Start Work Check activities (CLAUDE.md §15, Roles pass). An Auditor (or Admin) sets up a check for one job with the
// number of people taking part. Each person joins it (join code, open-checks list, or link / QR) and answers their own
// Start Work Check (an Assessment with `activityId`). The Auditor closes it when the job is cleared.
//
// MOCK: these rules run in the browser. Production: behind API routes, and joining (place count + create) runs in one
// transaction so two people cannot take the last place at the same time.

import { z } from "zod";
import {
  assessments,
  auditTypes,
  locations,
  modules,
  RepositoryError,
  responses,
  startWorkActivities,
  users,
  vessels,
} from "@/lib/data";
import { parseOrThrow, ValidationError } from "@/lib/services/errors";
import { JOIN_CODE_LENGTH, normalizeJoinCode } from "@/lib/services/join-codes";
import {
  PermissionError,
  START_WORK_AUDIT_CODE,
  canCloseActivity,
  canInitiateStartWork,
  canUseAuditType,
  canViewAssessment,
  requireUser,
  type Principal,
} from "@/lib/services/permissions";
import type { Assessment, ID, StartWorkActivity, StartWorkActivityStatus } from "@/lib/types";

export const TASK_DESCRIPTION_LENGTH = { min: 3, max: 200 } as const;
export const TEAM_SIZE_RANGE = { min: 1, max: 99 } as const;
export const CLOSURE_COMMENT_MAX_LENGTH = 500;

// ---------- Setting one up (Auditor / Admin) ----------

export const activitySetupSchema = z.object({
  moduleId: z.string().min(1, { error: "Choose the task" }),
  vesselId: z.string().min(1, { error: "Choose a vessel" }),
  locationId: z.string().min(1, { error: "Choose a location" }),
  taskDescription: z
    .string()
    .trim()
    .min(TASK_DESCRIPTION_LENGTH.min, { error: "Describe the job the team is about to start" })
    .max(TASK_DESCRIPTION_LENGTH.max, { error: `Keep it under ${TASK_DESCRIPTION_LENGTH.max} characters` }),
  teamSize: z
    .number({ error: `Enter the number of people (${TEAM_SIZE_RANGE.min}–${TEAM_SIZE_RANGE.max})` })
    .int({ error: "Enter a whole number" })
    .min(TEAM_SIZE_RANGE.min, { error: `Enter the number of people (${TEAM_SIZE_RANGE.min}–${TEAM_SIZE_RANGE.max})` })
    .max(TEAM_SIZE_RANGE.max, { error: `Enter the number of people (${TEAM_SIZE_RANGE.min}–${TEAM_SIZE_RANGE.max})` }),
});

export type ActivitySetupValues = z.input<typeof activitySetupSchema>;

/** Creates an OPEN Start Work Check with its reference (VAH-S-…) and join code. Auditors and admins only. */
export async function createActivity(actor: Principal, input: ActivitySetupValues): Promise<StartWorkActivity> {
  const user = requireUser(actor);
  if (!canInitiateStartWork(user)) {
    throw new PermissionError("FORBIDDEN", "Only auditors and admins can set up a Start Work Check.");
  }
  const values = parseOrThrow(activitySetupSchema, input);
  const [vessel, location, task] = await Promise.all([
    vessels.get(values.vesselId),
    locations.get(values.locationId),
    modules.get(values.moduleId),
  ]);
  if (!vessel || vessel.status !== "ACTIVE") {
    throw new ValidationError("This vessel is not available.", { vesselId: "Choose an active vessel" });
  }
  if (!location || !location.active) {
    throw new ValidationError("This location is not available.", { locationId: "Choose an active location" });
  }
  if (!task || !task.active || task.category !== "START_WORK") {
    throw new ValidationError("This task is not available.", { moduleId: "Choose an available task" });
  }
  return startWorkActivities.create({ ...values, createdById: user.id });
}

// ---------- Reading ----------

export interface ActivityParticipant {
  assessment: Assessment;
  /** Number of No (Non-Compliant) answers; only counted once submitted. */
  noCount: number;
  /** Whether the viewer may open this person's check. */
  canOpen: boolean;
}

export interface ActivitySummary {
  activity: StartWorkActivity;
  taskName: string;
  locationName: string;
  joined: number;
  submitted: number;
  /** The viewer's own check in this activity, if they joined. */
  mine: Assessment | null;
  /** The viewer set this check up (the verifier): they manage it rather than answer it. */
  isCreator: boolean;
  /** Why the viewer cannot join (closed, full), or null if they can (or already joined). */
  joinBlock: string | null;
}

function joinBlockFor(activity: StartWorkActivity, joined: number, mine: Assessment | null, actorId: ID): string | null {
  if (mine) return null;
  if (activity.status === "CLOSED") return "This Start Work Check is closed.";
  if (activity.createdById === actorId) return "You set up this check: the crew answer it, you verify and close it.";
  if (joined >= activity.teamSize) {
    return `All ${activity.teamSize} places are taken. Ask the auditor to check the team list.`;
  }
  return null;
}

async function summarise(actorId: ID, list: StartWorkActivity[]): Promise<ActivitySummary[]> {
  if (list.length === 0) return [];
  const [moduleList, locationList, checks] = await Promise.all([
    modules.list(),
    locations.list(),
    // MOCK: loads every assessment and groups them here. Production: a COUNT … GROUP BY activity_id query.
    assessments.list(),
  ]);
  const nameOf = (items: { id: ID; name: string }[], id: ID) => items.find((i) => i.id === id)?.name ?? "";
  return list.map((activity) => {
    const participants = checks.filter((a) => a.activityId === activity.id);
    const mine = participants.find((a) => a.userId === actorId) ?? null;
    return {
      activity,
      taskName: nameOf(moduleList, activity.moduleId),
      locationName: nameOf(locationList, activity.locationId),
      joined: participants.length,
      submitted: participants.filter((a) => a.status === "SUBMITTED").length,
      mine,
      isCreator: activity.createdById === actorId,
      joinBlock: joinBlockFor(activity, participants.length, mine, actorId),
    };
  });
}

export interface ActivityListFilter {
  status?: StartWorkActivityStatus;
  vesselId?: ID;
  /** Only checks set up by the viewer (auditors' "My Start Work Checks"). */
  mine?: boolean;
}

/** Start Work Checks with their joined / submitted counts, newest first. Every signed-in user may list them. */
export async function listActivities(actor: Principal, filter: ActivityListFilter = {}): Promise<ActivitySummary[]> {
  const user = requireUser(actor);
  const list = await startWorkActivities.list({
    status: filter.status,
    vesselId: filter.vesselId || undefined,
    createdById: filter.mine ? user.id : undefined,
  });
  return summarise(user.id, list);
}

/** How many Start Work Checks are open right now (hub tile badge). */
export async function countOpenActivities(actor: Principal): Promise<number> {
  requireUser(actor);
  return (await startWorkActivities.list({ status: "OPEN" })).length;
}

export interface ActivityDetail extends ActivitySummary {
  participants: ActivityParticipant[];
  createdByName: string;
  closedByName: string | null;
  canClose: boolean;
}

/** Everything the activity page shows. Missing activities throw NOT_FOUND. */
export async function loadActivity(actor: Principal, id: ID): Promise<ActivityDetail> {
  const user = requireUser(actor);
  const activity = await startWorkActivities.get(id);
  if (!activity) throw new RepositoryError("NOT_FOUND", "This Start Work Check doesn't exist.");
  const [[summary], checks, closedBy] = await Promise.all([
    summarise(user.id, [activity]),
    assessments.list({ activityId: id }),
    activity.closedById ? users.get(activity.closedById) : Promise.resolve(null),
  ]);
  const participants = await Promise.all(
    checks
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(async (assessment): Promise<ActivityParticipant> => {
        const noCount =
          assessment.status === "SUBMITTED"
            ? (await responses.listByAssessment(assessment.id)).filter((r) => r.answer === "NO").length
            : 0;
        return { assessment, noCount, canOpen: canViewAssessment(user, assessment) };
      }),
  );
  return {
    ...summary,
    participants,
    createdByName: activity.snapshot.createdByName,
    closedByName: closedBy?.name ?? null,
    canClose: canCloseActivity(user, activity),
  };
}

/** Looks up an activity by its join code. Unknown or closed codes are a field error on `code`. */
export async function findActivityByCode(actor: Principal, code: string): Promise<StartWorkActivity> {
  requireUser(actor);
  const wanted = normalizeJoinCode(code);
  if (wanted.length !== JOIN_CODE_LENGTH) {
    throw new ValidationError(`Enter the ${JOIN_CODE_LENGTH}-character code.`, {
      code: `Enter the ${JOIN_CODE_LENGTH}-character code from your auditor`,
    });
  }
  const activity = await startWorkActivities.findByCode(wanted);
  if (!activity) {
    throw new ValidationError("No Start Work Check has this code.", {
      code: "No Start Work Check has this code. Check it with your auditor.",
    });
  }
  if (activity.status === "CLOSED") {
    throw new ValidationError("This Start Work Check is closed.", {
      code: `${activity.reference} is closed. Ask your auditor for the current code.`,
    });
  }
  return activity;
}

// ---------- Joining (everyone) ----------

/**
 * Joins the actor to an OPEN Start Work Check: creates their own START_WORK draft with the activity's task, vessel,
 * location, job and team size. Joining twice returns the existing check. Refused once every place is taken.
 */
export async function joinActivity(actor: Principal, id: ID): Promise<Assessment> {
  const user = requireUser(actor);
  const activity = await startWorkActivities.get(id);
  if (!activity) throw new RepositoryError("NOT_FOUND", "This Start Work Check doesn't exist.");

  const participants = await assessments.list({ activityId: id });
  const mine = participants.find((a) => a.userId === user.id);
  if (mine) return mine;

  const block = joinBlockFor(activity, participants.length, null, user.id);
  if (block) throw new RepositoryError("CONFLICT", block);

  const [task, auditTypeList] = await Promise.all([modules.get(activity.moduleId), auditTypes.list({ activeOnly: true })]);
  if (!task || !task.active) throw new RepositoryError("CONFLICT", "This task has been deactivated.");
  const auditType = auditTypeList.find((t) => t.code === START_WORK_AUDIT_CODE);
  if (!auditType || !canUseAuditType(user.role, auditType)) {
    throw new PermissionError("FORBIDDEN", "The Start Work Check audit type is not available to your role.");
  }

  return assessments.create({
    kind: "START_WORK",
    moduleIds: [activity.moduleId],
    userId: user.id,
    vesselId: activity.vesselId,
    locationId: activity.locationId,
    auditTypeId: auditType.id,
    startWork: { taskDescription: activity.taskDescription, teamSize: activity.teamSize },
    activityId: activity.id,
  });
}

// ---------- Closing (the activity's Auditor / Admin) ----------

/**
 * Closes the check: no more joining or submitting. Participants who had not submitted keep their draft (shown as
 * "Not submitted"). Who closed it and when is recorded.
 */
export async function closeActivity(actor: Principal, id: ID, comment = ""): Promise<StartWorkActivity> {
  const user = requireUser(actor);
  const activity = await startWorkActivities.get(id);
  if (!activity) throw new RepositoryError("NOT_FOUND", "This Start Work Check doesn't exist.");
  if (activity.status === "CLOSED") throw new RepositoryError("CONFLICT", `${activity.reference} is already closed.`);
  if (!canCloseActivity(user, activity)) {
    throw new PermissionError("FORBIDDEN", "Only the auditor who set up this Start Work Check (or an admin) can close it.");
  }
  const note = comment.trim();
  if (note.length > CLOSURE_COMMENT_MAX_LENGTH) {
    throw new ValidationError("The comment is too long.", {
      closureComment: `Keep it under ${CLOSURE_COMMENT_MAX_LENGTH} characters`,
    });
  }
  return startWorkActivities.update(id, {
    status: "CLOSED",
    closedById: user.id,
    closedAt: new Date().toISOString(),
    closureComment: note || null,
  });
}
