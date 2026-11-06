"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { FormField, fieldA11y } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { ToggleChips } from "@/components/forms/toggle-chips";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ValidationError } from "@/lib/services/errors";
import { WEIGHT_MAX, WEIGHT_MIN, saveQuestion, type QuestionFormValues } from "@/lib/services/questions";
import type { AuditType, LookupItem, Module, Question } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation/common";
import { useAdminAction } from "./use-admin-action";

export interface QuestionReferenceData {
  modules: Module[];
  riskCategories: LookupItem[];
  vesselTypes: LookupItem[];
  auditTypes: AuditType[];
}

interface QuestionFormSheetProps extends QuestionReferenceData {
  question: Question | null;
  /** Pre-selected module for a new question. */
  defaultModuleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WEIGHTS = Array.from({ length: WEIGHT_MAX - WEIGHT_MIN + 1 }, (_, i) => WEIGHT_MIN + i);

export function QuestionFormSheet(props: QuestionFormSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {props.open && <QuestionForm {...props} />}
      </SheetContent>
    </Sheet>
  );
}

function QuestionForm({
  question,
  defaultModuleId,
  onOpenChange,
  modules,
  riskCategories,
  vesselTypes,
  auditTypes,
}: QuestionFormSheetProps) {
  const [values, setValues] = useState<QuestionFormValues>({
    moduleId: question?.moduleId ?? defaultModuleId,
    text: question?.text ?? "",
    riskCategoryId: question?.riskCategoryId ?? "",
    weight: question?.weight ?? 1,
    criticalControl: question?.criticalControl ?? false,
    evidenceRequired: question?.evidenceRequired ?? false,
    vesselTypeIds: question?.vesselTypeIds ?? [],
    auditTypeIds: question?.auditTypeIds ?? [],
    active: question?.active ?? true,
  });
  const [errors, setErrors] = useState<FieldErrors<QuestionFormValues>>({});
  const save = useAdminAction((actor, v: QuestionFormValues) => saveQuestion(actor, question?.id ?? null, v), {
    success: () => (question ? "Question updated" : "Question added"),
    invalidates: [["questions"], ["modules"]],
    onSuccess: () => onOpenChange(false),
  });

  const patch = (next: Partial<QuestionFormValues>) => setValues((v) => ({ ...v, ...next }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    try {
      await save.mutateAsync(values);
    } catch (error) {
      if (error instanceof ValidationError) setErrors(error.fieldErrors as FieldErrors<QuestionFormValues>);
    }
  }

  const activeOr = <T extends { id: string; active: boolean }>(items: T[], keep: string[]) =>
    items.filter((i) => i.active || keep.includes(i.id));

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      <SheetHeader>
        <SheetTitle>{question ? "Edit question" : "Add question"}</SheetTitle>
        <SheetDescription>
          Write it in the first person, e.g. &ldquo;I have confirmed…&rdquo; or &ldquo;I know…&rdquo;.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 px-4">
        {question && (
          <p className="flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Changes apply to new assessments only. Submitted assessments keep the wording and weight they were answered
            with.
          </p>
        )}

        <FormField id="moduleId" label="Module" error={errors.moduleId}>
          <NativeSelect
            {...fieldA11y("moduleId", errors.moduleId)}
            value={values.moduleId}
            onChange={(e) => patch({ moduleId: e.target.value })}
          >
            <option value="" disabled>
              Choose a module
            </option>
            {activeOr(modules, [values.moduleId]).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.active ? "" : " (inactive)"}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField id="text" label="Question" error={errors.text}>
          <Textarea
            {...fieldA11y("text", errors.text)}
            rows={3}
            value={values.text}
            onChange={(e) => patch({ text: e.target.value })}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="riskCategoryId" label="Risk category" error={errors.riskCategoryId}>
            <NativeSelect
              {...fieldA11y("riskCategoryId", errors.riskCategoryId)}
              value={values.riskCategoryId}
              onChange={(e) => patch({ riskCategoryId: e.target.value })}
            >
              <option value="" disabled>
                Choose…
              </option>
              {activeOr(riskCategories, [values.riskCategoryId]).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="weight" label="Weight" error={errors.weight} hint="Higher counts more in the score.">
            <NativeSelect
              {...fieldA11y("weight", errors.weight)}
              value={values.weight}
              onChange={(e) => patch({ weight: Number(e.target.value) })}
            >
              {WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="criticalControl"
              checked={values.criticalControl}
              onCheckedChange={(checked) => patch({ criticalControl: checked === true })}
            />
            <Label htmlFor="criticalControl" className="flex-col items-start gap-0.5">
              Critical control
              <span className="text-xs font-normal text-muted-foreground">
                A &ldquo;No&rdquo; automatically raises a High-risk finding with an action owner.
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="evidenceRequired"
              checked={values.evidenceRequired}
              onCheckedChange={(checked) => patch({ evidenceRequired: checked === true })}
            />
            <Label htmlFor="evidenceRequired" className="flex-col items-start gap-0.5">
              Evidence required
              <span className="text-xs font-normal text-muted-foreground">
                A photo is required when the answer is &ldquo;No&rdquo; or &ldquo;Concern Identified&rdquo;.
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="active" checked={values.active} onCheckedChange={(checked) => patch({ active: checked === true })} />
            <Label htmlFor="active">Active (asked in new assessments)</Label>
          </div>
        </div>

        <FormField id="vesselTypeIds" label="Applies to vessel types" error={errors.vesselTypeIds}>
          <ToggleChips
            id="vesselTypeIds"
            options={activeOr(vesselTypes, values.vesselTypeIds).map((t) => ({ value: t.id, label: t.name }))}
            selected={values.vesselTypeIds}
            onChange={(vesselTypeIds) => patch({ vesselTypeIds })}
            emptyLabel="All vessel types"
            invalid={!!errors.vesselTypeIds}
          />
        </FormField>

        <FormField id="auditTypeIds" label="Applies to audit types" error={errors.auditTypeIds}>
          <ToggleChips
            id="auditTypeIds"
            options={activeOr(auditTypes, values.auditTypeIds).map((t) => ({ value: t.id, label: t.name }))}
            selected={values.auditTypeIds}
            onChange={(auditTypeIds) => patch({ auditTypeIds })}
            emptyLabel="All audit types"
            invalid={!!errors.auditTypeIds}
          />
        </FormField>
      </div>

      <SheetFooter className="flex-row gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={save.isPending}>
          {save.isPending ? "Saving…" : question ? "Save changes" : "Add question"}
        </Button>
      </SheetFooter>
    </form>
  );
}
