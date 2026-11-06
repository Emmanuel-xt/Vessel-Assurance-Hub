// Admin location management. Locations are never deleted, only deactivated.

import { z } from "zod";
import { locations } from "@/lib/data";
import { parseOrThrow } from "@/lib/services/errors";
import type { Principal } from "@/lib/services/permissions";
import type { ID, Location } from "@/lib/types";
import { assertUniqueName, orNotFound, requireAdmin } from "./shared";

export const locationFormSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter the location name" }).max(60),
});

export type LocationFormValues = z.input<typeof locationFormSchema>;

export async function createLocation(actor: Principal, input: LocationFormValues): Promise<Location> {
  requireAdmin(actor);
  const { name } = parseOrThrow(locationFormSchema, input);
  assertUniqueName(await locations.list(), name, null, "location");
  return locations.create({ name });
}

export async function renameLocation(actor: Principal, id: ID, input: LocationFormValues): Promise<Location> {
  requireAdmin(actor);
  const { name } = parseOrThrow(locationFormSchema, input);
  orNotFound(await locations.get(id), "Location", id);
  assertUniqueName(await locations.list(), name, id, "location");
  return locations.update(id, { name });
}

export async function setLocationActive(actor: Principal, id: ID, active: boolean): Promise<Location> {
  requireAdmin(actor);
  orNotFound(await locations.get(id), "Location", id);
  return locations.update(id, { active });
}
