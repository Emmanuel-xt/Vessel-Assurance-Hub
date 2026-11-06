"use client";

import { useState } from "react";
import { FormField, INPUT_CLASS, fieldA11y } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ValidationError } from "@/lib/services/errors";
import { saveVessel, type VesselFormValues } from "@/lib/services/admin/vessels";
import type { LookupItem, Vessel } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation/common";
import { useAdminAction } from "./use-admin-action";

interface VesselFormSheetProps {
  /** null = add a new vessel. */
  vessel: Vessel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vesselTypes: LookupItem[];
  packages: LookupItem[];
  locations: LookupItem[];
}

function initialValues(vessel: Vessel | null, vesselTypes: LookupItem[]): VesselFormValues {
  return {
    name: vessel?.name ?? "",
    vesselTypeName: vesselTypes.find((t) => t.id === vessel?.vesselTypeId)?.name ?? "",
    packageId: vessel?.packageId ?? "",
    defaultLocationId: vessel?.defaultLocationId ?? "",
    contractor: vessel?.contractor ?? "",
    status: vessel?.status ?? "ACTIVE",
  };
}

/** Active options, plus the record's current value even if it has since been deactivated. */
const optionsFor = (items: LookupItem[], currentId: string) =>
  items.filter((item) => item.active || item.id === currentId);

export function VesselFormSheet(props: VesselFormSheetProps) {
  // Remount the form each time it opens so it starts from the selected vessel's values.
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {props.open && <VesselForm {...props} />}
      </SheetContent>
    </Sheet>
  );
}

function VesselForm({ vessel, onOpenChange, vesselTypes, packages, locations }: VesselFormSheetProps) {
  const [values, setValues] = useState<VesselFormValues>(() => initialValues(vessel, vesselTypes));
  const [errors, setErrors] = useState<FieldErrors<VesselFormValues>>({});
  const save = useAdminAction((actor, v: VesselFormValues) => saveVessel(actor, vessel?.id ?? null, v), {
    success: (saved) => `${saved.name} ${vessel ? "updated" : "added"}`,
    invalidates: [["vessels"], ["vesselTypes"]],
    onSuccess: () => onOpenChange(false),
  });

  const set = (field: keyof VesselFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [field]: event.target.value }));

  const typed = values.vesselTypeName.trim().toLowerCase();
  const suggestions = vesselTypes
    .filter((t) => t.active && (!typed || t.name.toLowerCase().includes(typed)) && t.name.toLowerCase() !== typed)
    .slice(0, 8);
  const isNewType = typed.length > 0 && !vesselTypes.some((t) => t.name.toLowerCase() === typed);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    try {
      await save.mutateAsync(values);
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fieldErrors as FieldErrors<VesselFormValues>);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      <SheetHeader>
        <SheetTitle>{vessel ? `Edit ${vessel.name}` : "Add vessel"}</SheetTitle>
        <SheetDescription>Vessels are never deleted. Set the status to Inactive to retire one.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 px-4">
        <FormField id="name" label="Vessel name" error={errors.name}>
          <Input {...fieldA11y("name", errors.name)} className={INPUT_CLASS} value={values.name} onChange={set("name")} />
        </FormField>

        <FormField
          id="vesselTypeName"
          label="Vessel type"
          error={errors.vesselTypeName}
          hint={isNewType ? `"${values.vesselTypeName.trim()}" will be added as a new vessel type.` : "Type to search, or pick a suggestion."}
        >
          <Input
            {...fieldA11y("vesselTypeName", errors.vesselTypeName)}
            className={INPUT_CLASS}
            list="vessel-type-options"
            autoComplete="off"
            value={values.vesselTypeName}
            onChange={set("vesselTypeName")}
          />
          <datalist id="vessel-type-options">
            {vesselTypes.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Vessel type suggestions">
              {suggestions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm hover:bg-muted"
                  onClick={() => setValues((v) => ({ ...v, vesselTypeName: t.name }))}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </FormField>

        <FormField id="packageId" label="Package" error={errors.packageId}>
          <NativeSelect {...fieldA11y("packageId", errors.packageId)} value={values.packageId} onChange={set("packageId")}>
            <option value="" disabled>
              Choose a package
            </option>
            {optionsFor(packages, values.packageId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField id="defaultLocationId" label="Default location" error={errors.defaultLocationId}>
          <NativeSelect
            {...fieldA11y("defaultLocationId", errors.defaultLocationId)}
            value={values.defaultLocationId}
            onChange={set("defaultLocationId")}
          >
            <option value="" disabled>
              Choose a location
            </option>
            {optionsFor(locations, values.defaultLocationId).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.active ? "" : " (inactive)"}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField id="contractor" label="Contractor (optional)" error={errors.contractor} hint="The vessel's operator, if known.">
          <Input
            {...fieldA11y("contractor", errors.contractor)}
            className={INPUT_CLASS}
            value={values.contractor ?? ""}
            onChange={set("contractor")}
          />
        </FormField>

        <FormField id="status" label="Status" error={errors.status}>
          <NativeSelect {...fieldA11y("status", errors.status)} value={values.status} onChange={set("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </NativeSelect>
        </FormField>
      </div>

      <SheetFooter className="flex-row gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={save.isPending}>
          {save.isPending ? "Saving…" : vessel ? "Save changes" : "Add vessel"}
        </Button>
      </SheetFooter>
    </form>
  );
}
