// Admin vessel management. Vessels are never deleted, only deactivated.

import { z } from "zod";
import { locations, packages, vessels, vesselTypes } from "@/lib/data";
import { parseOrThrow, ValidationError } from "@/lib/services/errors";
import type { Principal } from "@/lib/services/permissions";
import type { ID, Vessel, VesselStatus } from "@/lib/types";
import { assertUniqueName, findByName, orNotFound, requireAdmin } from "./shared";

export const vesselFormSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter the vessel name" }).max(80),
  /** Free text: matched to an existing vessel type by name, or created as a new type. */
  vesselTypeName: z.string().trim().min(2, { error: "Enter or choose a vessel type" }).max(50),
  packageId: z.string().min(1, { error: "Choose a package" }),
  defaultLocationId: z.string().min(1, { error: "Choose a default location" }),
  contractor: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || null),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type VesselFormValues = z.input<typeof vesselFormSchema>;

/** Creates (id = null) or updates a vessel. Unknown vessel type names become new vessel types. */
export async function saveVessel(actor: Principal, id: ID | null, input: VesselFormValues): Promise<Vessel> {
  requireAdmin(actor);
  const values = parseOrThrow(vesselFormSchema, input);

  const [allVessels, allTypes, pkg, location] = await Promise.all([
    vessels.list(),
    vesselTypes.list(),
    packages.get(values.packageId),
    locations.get(values.defaultLocationId),
  ]);
  assertUniqueName(allVessels, values.name, id, "vessel");
  if (!pkg) throw new ValidationError("Choose a package.", { packageId: "Choose a package" });
  if (!location) throw new ValidationError("Choose a default location.", { defaultLocationId: "Choose a location" });

  const existingType = findByName(allTypes, values.vesselTypeName);
  const vesselType = existingType ?? (await vesselTypes.create({ name: values.vesselTypeName }));
  if (!vesselType.active) await vesselTypes.update(vesselType.id, { active: true });

  const record = {
    name: values.name,
    vesselTypeId: vesselType.id,
    packageId: values.packageId,
    defaultLocationId: values.defaultLocationId,
    contractor: values.contractor,
    status: values.status,
  };
  if (id === null) return vessels.create(record);
  orNotFound(await vessels.get(id), "Vessel", id);
  return vessels.update(id, record);
}

export async function setVesselStatus(actor: Principal, id: ID, status: VesselStatus): Promise<Vessel> {
  requireAdmin(actor);
  orNotFound(await vessels.get(id), "Vessel", id);
  return vessels.update(id, { status });
}
