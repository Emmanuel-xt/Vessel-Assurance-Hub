// Admin user management: approve, reject, disable / re-enable, change role.

import { users, type UserFilter } from "@/lib/data";
import { ValidationError } from "@/lib/services/errors";
import { PermissionError, canChangeUserRole, canChangeUserStatus, type Principal } from "@/lib/services/permissions";
import type { ID, PublicUser, Role, User, UserStatus } from "@/lib/types";
import { assertAllowed, orNotFound, requireAdmin } from "./shared";

function toPublic(user: User): PublicUser {
  const copy: Partial<User> = { ...user };
  delete copy.password;
  return copy as PublicUser;
}

const STATUS_ORDER: Record<UserStatus, number> = { PENDING: 0, ACTIVE: 1, DISABLED: 2 };

/** Users for the admin table: pending first (oldest request first), then everyone else by name. */
export async function listUsersForAdmin(actor: Principal, filter: UserFilter = {}): Promise<PublicUser[]> {
  requireAdmin(actor);
  const list = await users.list(filter);
  return list
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.status === "PENDING" ? a.createdAt.localeCompare(b.createdAt) : a.name.localeCompare(b.name)),
    )
    .map(toPublic);
}

async function activeAdminCount(): Promise<number> {
  return (await users.list({ role: "ADMIN", status: "ACTIVE" })).length;
}

async function changeStatus(actor: Principal, userId: ID, next: UserStatus, requiredCurrent?: UserStatus) {
  requireAdmin(actor);
  const target = orNotFound(await users.get(userId), "User", userId);
  if (requiredCurrent && target.status !== requiredCurrent) {
    throw new PermissionError("FORBIDDEN", `Only ${requiredCurrent.toLowerCase()} accounts can be changed this way.`);
  }
  assertAllowed(canChangeUserStatus(actor, target, next, await activeAdminCount()));
  return toPublic(await users.update(userId, { status: next }));
}

/** PENDING → ACTIVE */
export const approveUser = (actor: Principal, userId: ID) => changeStatus(actor, userId, "ACTIVE", "PENDING");

/** PENDING → DISABLED */
export const rejectUser = (actor: Principal, userId: ID) => changeStatus(actor, userId, "DISABLED", "PENDING");

/** ACTIVE → DISABLED */
export const disableUser = (actor: Principal, userId: ID) => changeStatus(actor, userId, "DISABLED", "ACTIVE");

/** DISABLED → ACTIVE */
export const reEnableUser = (actor: Principal, userId: ID) => changeStatus(actor, userId, "ACTIVE", "DISABLED");

const ROLES: readonly Role[] = ["WORKER", "SUPERVISOR", "ADMIN"];

export async function changeUserRole(actor: Principal, userId: ID, role: Role): Promise<PublicUser> {
  requireAdmin(actor);
  if (!ROLES.includes(role)) throw new ValidationError("Choose a valid role.", { role: "Choose a valid role" });
  const target = orNotFound(await users.get(userId), "User", userId);
  assertAllowed(canChangeUserRole(actor, target, role, await activeAdminCount()));
  return toPublic(await users.update(userId, { role }));
}
