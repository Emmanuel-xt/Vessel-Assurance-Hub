// Admin module management. Modules are never deleted, only deactivated (their questions stay intact).

import { z } from "zod";
import { modules } from "@/lib/data";
import { parseOrThrow } from "@/lib/services/errors";
import { moveInOrder, nextDisplayOrder, type MoveDirection } from "@/lib/services/ordering";
import { MODULE_AUDIENCE_ROLES, type Principal } from "@/lib/services/permissions";
import type { ID, Module } from "@/lib/types";
import { assertUniqueName, orNotFound, requireAdmin } from "./shared";

export const moduleFormSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter the module name" }).max(60),
  description: z.string().trim().max(300),
  category: z.enum(["START_WORK", "ASSURANCE"], { error: "Choose a category" }),
  /** Roles that see the module on the LOD 1 list; empty = everyone. Admins always see every module. */
  roles: z.array(z.enum(MODULE_AUDIENCE_ROLES)).default([]),
  active: z.boolean(),
});

export type ModuleFormValues = z.input<typeof moduleFormSchema>;

/** Creates (id = null, added at the end) or updates a module. */
export async function saveModule(actor: Principal, id: ID | null, input: ModuleFormValues): Promise<Module> {
  requireAdmin(actor);
  const parsed = parseOrThrow(moduleFormSchema, input);
  // Start Work modules are reached through the Start Work Check, so the LOD 1 audience does not apply.
  const values = { ...parsed, roles: parsed.category === "START_WORK" ? [] : [...new Set(parsed.roles)] };
  const all = await modules.list();
  assertUniqueName(all, values.name, id, "module");
  if (id === null) return modules.create({ ...values, displayOrder: nextDisplayOrder(all) });
  orNotFound(await modules.get(id), "Module", id);
  return modules.update(id, values);
}

export async function setModuleActive(actor: Principal, id: ID, active: boolean): Promise<Module> {
  requireAdmin(actor);
  orNotFound(await modules.get(id), "Module", id);
  return modules.update(id, { active });
}

/** Moves a module one place up or down in the hub order. */
export async function moveModule(actor: Principal, id: ID, direction: MoveDirection): Promise<void> {
  requireAdmin(actor);
  const changes = moveInOrder(await modules.list(), id, direction);
  await Promise.all(changes.map(({ id: moduleId, displayOrder }) => modules.update(moduleId, { displayOrder })));
}
