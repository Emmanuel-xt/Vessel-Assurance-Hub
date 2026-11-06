// Permission rules (CLAUDE.md §3). Pure functions: the same checks will run on a real backend.

import type { Assessment, AssessmentKind, AuditType, Role, User, UserStatus } from "@/lib/types";

export type PermissionErrorCode = "UNAUTHENTICATED" | "FORBIDDEN";

export class PermissionError extends Error {
  constructor(
    public readonly code: PermissionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

/** The fields permission checks need, so both User and PublicUser work. */
export type Principal = Pick<User, "id" | "role" | "status">;

/** Roles a person may request on the signup form. ADMIN is granted by an admin only. */
export const SELF_SIGNUP_ROLES = ["WORKER", "SUPERVISOR"] as const satisfies readonly Role[];

/** Why an account cannot sign in, or null if it can. */
export function signInBlock(status: UserStatus): "PENDING_APPROVAL" | "ACCOUNT_DISABLED" | null {
  if (status === "PENDING") return "PENDING_APPROVAL";
  if (status === "DISABLED") return "ACCOUNT_DISABLED";
  return null;
}

/** Returns the user if signed in and ACTIVE; throws UNAUTHENTICATED otherwise. */
export function requireUser<T extends Principal>(user: T | null | undefined): T {
  if (!user || user.status !== "ACTIVE") {
    throw new PermissionError("UNAUTHENTICATED", "Please log in to continue.");
  }
  return user;
}

export function hasRole(user: Principal | null | undefined, ...roles: Role[]): boolean {
  return !!user && user.status === "ACTIVE" && roles.includes(user.role);
}

/** Returns the user if they hold one of the roles; throws UNAUTHENTICATED or FORBIDDEN otherwise. */
export function requireRole<T extends Principal>(user: T | null | undefined, ...roles: Role[]): T {
  const active = requireUser(user);
  if (!roles.includes(active.role)) {
    throw new PermissionError("FORBIDDEN", "You do not have access to this page.");
  }
  return active;
}

export function canAccessAdmin(user: Principal | null | undefined): boolean {
  return hasRole(user, "ADMIN");
}

/** Supervisors (read-only) and admins (full) see the dashboard. */
export function canViewDashboard(user: Principal | null | undefined): boolean {
  return hasRole(user, "SUPERVISOR", "ADMIN");
}

// ---------- User management (admin) ----------

export type Decision = { allowed: true } | { allowed: false; reason: string };

/** The reason a decision was denied, or undefined if allowed. */
export const denialReason = (decision: Decision): string | undefined =>
  decision.allowed ? undefined : decision.reason;

const ALLOW: Decision = { allowed: true };
const deny = (reason: string): Decision => ({ allowed: false, reason });

type ManagedUser = Pick<User, "id" | "role" | "status">;

/** True when this change would remove the only remaining active admin. */
function removesLastAdmin(target: ManagedUser, stillAdminAfter: boolean, activeAdminCount: number): boolean {
  return target.role === "ADMIN" && target.status === "ACTIVE" && !stillAdminAfter && activeAdminCount <= 1;
}

/**
 * Whether an admin may move a user to a new status (approve, reject, disable, re-enable).
 * Admins cannot disable themselves, and the last active admin cannot be disabled.
 */
export function canChangeUserStatus(
  actor: Principal,
  target: ManagedUser,
  next: UserStatus,
  activeAdminCount: number,
): Decision {
  if (!canAccessAdmin(actor)) return deny("Only admins can manage users.");
  if (target.status === next) return deny(`This account is already ${next.toLowerCase()}.`);
  if (next === "PENDING") return deny("An account cannot be moved back to pending.");
  if (actor.id === target.id && next !== "ACTIVE") return deny("You cannot disable your own account.");
  if (removesLastAdmin(target, next === "ACTIVE", activeAdminCount)) {
    return deny("At least one active admin is required.");
  }
  return ALLOW;
}

/** Whether an admin may change a user's role. Admins cannot change their own role or demote the last admin. */
export function canChangeUserRole(
  actor: Principal,
  target: ManagedUser,
  next: Role,
  activeAdminCount: number,
): Decision {
  if (!canAccessAdmin(actor)) return deny("Only admins can manage users.");
  if (target.role === next) return deny(`This user is already a ${next.toLowerCase()}.`);
  if (actor.id === target.id) return deny("You cannot change your own role.");
  if (removesLastAdmin(target, next === "ADMIN", activeAdminCount)) {
    return deny("At least one active admin is required.");
  }
  return ALLOW;
}

// ---------- Assessments ----------

/** The audit type reserved for the Start Work Check tile. */
export const START_WORK_AUDIT_CODE = "START_WORK_CHECK";

/**
 * Audit types a role may pick for a kind of assessment. Start Work Checks use only the Start Work Check audit type;
 * module and Full Vessel assessments use every other audit type the role allows.
 */
export function allowedAuditTypesFor<T extends Pick<AuditType, "code" | "allowedRoles" | "active">>(
  role: Role,
  kind: AssessmentKind,
  auditTypes: T[],
): T[] {
  const forStartWork = kind === "START_WORK";
  return auditTypes.filter(
    (type) => (type.code === START_WORK_AUDIT_CODE) === forStartWork && canUseAuditType(role, type),
  );
}

type AssessmentAccess = Pick<Assessment, "userId" | "status">;

/** Owners see their own assessments; admins see all; supervisors see submitted ones (read-only drill-down). */
export function canViewAssessment(user: Principal | null | undefined, assessment: AssessmentAccess): boolean {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.id === assessment.userId || user.role === "ADMIN") return true;
  return user.role === "SUPERVISOR" && assessment.status === "SUBMITTED";
}

/** Only the person who started a draft can answer or change it. */
export function canEditAssessment(user: Principal | null | undefined, assessment: AssessmentAccess): boolean {
  return !!user && user.status === "ACTIVE" && user.id === assessment.userId && assessment.status === "DRAFT";
}

/**
 * Whether a role may pick an audit type. Driven by the audit type's `allowedRoles`, which admins can edit.
 * Seeded rule: Workers → Self Assessment and Start Work Check; Supervisors and Admins → all.
 */
export function canUseAuditType(role: Role, auditType: Pick<AuditType, "allowedRoles" | "active">): boolean {
  return auditType.active && auditType.allowedRoles.includes(role);
}
