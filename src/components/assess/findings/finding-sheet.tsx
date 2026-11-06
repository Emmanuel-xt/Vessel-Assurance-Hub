"use client";

import { useState } from "react";
import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { FormField, INPUT_CLASS, fieldA11y } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { ValidationError } from "@/lib/services/errors";
import {
  FINDING_DESCRIPTION_LENGTH,
  RISK_LABELS,
  RISK_LEVELS,
  TARGET_DAYS,
  defaultTargetDate,
  type AssignableUser,
  type FindingDraftValues,
} from "@/lib/services/findings";
import { businessToday } from "@/lib/services/overdue";
import type { FindingDraft, ID, RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { FieldErrors } from "@/lib/validation/common";
import { RISK_SELECTED } from "./finding-style";
import { OwnerPicker } from "./owner-picker";

export interface FindingSheetTarget {
  /** null = general finding, not tied to a question. */
  questionId: ID | null;
  questionText: string | null;
  /** Critical control answered No: risk is fixed at High and the finding can't be skipped later. */
  lockHigh: boolean;
  /** Opened automatically by a "No" answer: the dismiss button reads "Skip". */
  fromAnswer: boolean;
  /** Editing an existing prepared finding. */
  draft?: FindingDraft;
}

interface FindingSheetProps {
  target: FindingSheetTarget | null;
  onClose: () => void;
  owners: AssignableUser[];
  currentUserId: ID;
  onSave: (target: FindingSheetTarget, values: FindingDraftValues) => Promise<unknown>;
  onRemove: (draft: FindingDraft) => Promise<unknown>;
}

/** Bottom sheet to raise (or edit) a finding: description, risk, owner and target date. */
export function FindingSheet({ target, onClose, ...rest }: FindingSheetProps) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[92vh] w-full max-w-lg flex-col gap-0 rounded-t-2xl p-0">
        {target && (
          <FindingForm
            key={`${target.questionId ?? "general"}-${target.draft?.id ?? "new"}`}
            target={target}
            onClose={onClose}
            {...rest}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function FindingForm({ target, onClose, owners, currentUserId, onSave, onRemove }: FindingSheetProps & { target: FindingSheetTarget }) {
  const { draft, lockHigh } = target;
  const initialRisk: RiskLevel = lockHigh ? "HIGH" : (draft?.risk ?? "MEDIUM");
  const [values, setValues] = useState<FindingDraftValues>(() => ({
    description: draft?.description ?? target.questionText ?? "",
    risk: initialRisk,
    ownerId: draft?.ownerId ?? currentUserId,
    targetDate: draft?.targetDate ?? defaultTargetDate(initialRisk),
  }));
  // Once the user picks a date themselves, changing the risk no longer moves it.
  const [dateTouched, setDateTouched] = useState(!!draft);
  const [errors, setErrors] = useState<FieldErrors<FindingDraftValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);

  function chooseRisk(risk: RiskLevel) {
    setValues((v) => ({ ...v, risk, targetDate: dateTouched ? v.targetDate : defaultTargetDate(risk) }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setBusy("save");
    try {
      await onSave(target, values);
      onClose();
    } catch (error) {
      if (error instanceof ValidationError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors as FieldErrors<FindingDraftValues>);
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!draft) return;
    setBusy("remove");
    try {
      await onRemove(draft);
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b">
        <SheetTitle className="text-lg font-semibold">{draft ? "Edit finding" : "Raise finding"}</SheetTitle>
        <SheetDescription>
          {target.questionText ? target.questionText : "General finding, not tied to a question."}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {lockHigh && (
          <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Critical control answered No: the risk is High and the finding is required before you can submit.
          </p>
        )}
        {formError && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}

        <FormField id="finding-description" label="What did you find?" error={errors.description}>
          <Textarea
            {...fieldA11y("finding-description", errors.description)}
            rows={3}
            maxLength={FINDING_DESCRIPTION_LENGTH.max}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            className="text-base"
          />
        </FormField>

        <div className="space-y-1.5">
          <p id="finding-risk-label" className="text-sm font-medium">
            Risk
          </p>
          <div role="radiogroup" aria-labelledby="finding-risk-label" className="grid grid-cols-3 gap-2">
            {RISK_LEVELS.map((risk) => {
              const selected = values.risk === risk;
              const disabled = lockHigh && risk !== "HIGH";
              return (
                <button
                  key={risk}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => chooseRisk(risk)}
                  className={cn(
                    "h-12 rounded-xl border-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40",
                    selected ? RISK_SELECTED[risk] : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {RISK_LABELS[risk]}
                </button>
              );
            })}
          </div>
          {errors.risk && <p className="text-sm text-destructive">{errors.risk}</p>}
        </div>

        <FormField id="finding-owner" label="Action owner" error={errors.ownerId} hint="Who will make sure this is fixed.">
          <OwnerPicker
            id="finding-owner"
            users={owners}
            value={values.ownerId}
            onChange={(ownerId) => setValues({ ...values, ownerId })}
            currentUserId={currentUserId}
            invalid={!!errors.ownerId}
          />
        </FormField>

        <FormField
          id="finding-target"
          label="Target date"
          error={errors.targetDate}
          hint={`Default for ${RISK_LABELS[values.risk]} risk: ${TARGET_DAYS[values.risk]} days from today.`}
        >
          <Input
            {...fieldA11y("finding-target", errors.targetDate)}
            type="date"
            min={businessToday()}
            value={values.targetDate}
            onChange={(e) => {
              setDateTouched(true);
              setValues({ ...values, targetDate: e.target.value });
            }}
            className={INPUT_CLASS}
          />
        </FormField>
      </div>

      <SheetFooter className="border-t pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose} disabled={busy !== null}>
            {target.fromAnswer && !draft ? "Skip" : "Cancel"}
          </Button>
          <Button type="submit" className="h-12 flex-[1.4] text-base" disabled={busy !== null}>
            {busy === "save" && <Loader2 className="animate-spin" />} {draft ? "Save changes" : "Raise finding"}
          </Button>
        </div>
        {draft && (
          <Button type="button" variant="destructive" className="h-11" onClick={remove} disabled={busy !== null}>
            {busy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove finding
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">Findings are recorded when you submit the assessment.</p>
      </SheetFooter>
    </form>
  );
}
