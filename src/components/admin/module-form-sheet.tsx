"use client";

import { useState } from "react";
import { FormField, INPUT_CLASS, fieldA11y } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { saveModule, type ModuleFormValues } from "@/lib/services/admin/modules";
import { ValidationError } from "@/lib/services/errors";
import type { Module } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation/common";
import { useAdminAction } from "./use-admin-action";

interface ModuleFormSheetProps {
  module: Module | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CATEGORY_LABELS = { START_WORK: "Start Work", ASSURANCE: "Assurance" } as const;

export function ModuleFormSheet(props: ModuleFormSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {props.open && <ModuleForm {...props} />}
      </SheetContent>
    </Sheet>
  );
}

function ModuleForm({ module, onOpenChange }: ModuleFormSheetProps) {
  const [values, setValues] = useState<ModuleFormValues>({
    name: module?.name ?? "",
    description: module?.description ?? "",
    category: module?.category ?? "ASSURANCE",
    active: module?.active ?? true,
  });
  const [errors, setErrors] = useState<FieldErrors<ModuleFormValues>>({});
  const save = useAdminAction((actor, v: ModuleFormValues) => saveModule(actor, module?.id ?? null, v), {
    success: (m) => `${m.name} ${module ? "updated" : "added"}`,
    invalidates: [["modules"]],
    onSuccess: () => onOpenChange(false),
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    try {
      await save.mutateAsync(values);
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fieldErrors as FieldErrors<ModuleFormValues>);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      <SheetHeader>
        <SheetTitle>{module ? `Edit ${module.name}` : "Add module"}</SheetTitle>
        <SheetDescription>
          New modules are added at the end of the hub. Add questions to it on the Questions page.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 px-4">
        <FormField id="name" label="Module name" error={errors.name}>
          <Input
            {...fieldA11y("name", errors.name)}
            className={INPUT_CLASS}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </FormField>

        <FormField id="description" label="Description" error={errors.description} hint="Shown on the hub tile.">
          <Textarea
            {...fieldA11y("description", errors.description)}
            rows={3}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        </FormField>

        <FormField
          id="category"
          label="Category"
          error={errors.category}
          hint="Start Work modules appear under the Start Work Check; Assurance modules make up Full Vessel Assurance."
        >
          <NativeSelect
            {...fieldA11y("category", errors.category)}
            value={values.category}
            onChange={(e) => setValues({ ...values, category: e.target.value as ModuleFormValues["category"] })}
          >
            <option value="ASSURANCE">{CATEGORY_LABELS.ASSURANCE}</option>
            <option value="START_WORK">{CATEGORY_LABELS.START_WORK}</option>
          </NativeSelect>
        </FormField>

        <div className="flex items-center gap-3">
          <Checkbox
            id="active"
            checked={values.active}
            onCheckedChange={(checked) => setValues({ ...values, active: checked === true })}
          />
          <Label htmlFor="active">Active (shown on the hub)</Label>
        </div>
      </div>

      <SheetFooter className="flex-row gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={save.isPending}>
          {save.isPending ? "Saving…" : module ? "Save changes" : "Add module"}
        </Button>
      </SheetFooter>
    </form>
  );
}
