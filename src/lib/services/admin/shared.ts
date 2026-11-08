import { RepositoryError } from "@/lib/data";
import { ValidationError } from "@/lib/services/errors";
import { PermissionError, requireRole, type Decision, type Principal } from "@/lib/services/permissions";
import type { ID } from "@/lib/types";

/** Every admin action starts here. MOCK: runs in the browser today; production runs it on the server (see permissions.ts). */
export function requireAdmin(actor: Principal | null | undefined): Principal {
  return requireRole(actor, "ADMIN");
}

export function assertAllowed(decision: Decision): void {
  if (!decision.allowed) throw new PermissionError("FORBIDDEN", decision.reason);
}

export function orNotFound<T>(record: T | null, entity: string, id: ID): T {
  if (!record) throw new RepositoryError("NOT_FOUND", `${entity} ${id} not found`);
  return record;
}

const normalise = (value: string) => value.trim().toLowerCase();

/** Names must be unique (ignoring case and surrounding spaces) within a list. */
export function assertUniqueName(
  items: { id: ID; name: string }[],
  name: string,
  exceptId: ID | null,
  label: string,
  field = "name",
): void {
  const taken = items.some((item) => item.id !== exceptId && normalise(item.name) === normalise(name));
  if (taken) {
    throw new ValidationError(`A ${label} called "${name.trim()}" already exists.`, {
      [field]: `A ${label} with this name already exists.`,
    });
  }
}

export function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  return items.find((item) => normalise(item.name) === normalise(name));
}
