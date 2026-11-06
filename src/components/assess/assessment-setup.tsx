"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/admin/page-header";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, HardHat, ListChecks, Lock, Minus, Play, Plus, Ship } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { VesselPicker, type VesselOption } from "@/components/assess/vessel-picker";
import { FormField, fieldA11y } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { ModuleIcon } from "@/components/hub/module-icon";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { auditTypes, locations, packages, vessels, vesselTypes } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";
import {
  KIND_LABELS,
  TASK_DESCRIPTION_LENGTH,
  TEAM_SIZE_RANGE,
  countApplicableQuestions,
  modulesFor,
  startAssessment,
  type AssessmentSetupValues,
} from "@/lib/services/assessments";
import { ValidationError } from "@/lib/services/errors";
import { allowedAuditTypesFor } from "@/lib/services/permissions";
import type { AssessmentKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { FieldErrors } from "@/lib/validation/common";

function kindFromParam(param: string): AssessmentKind {
  if (param === "start-work") return "START_WORK";
  if (param === "full-vessel") return "FULL_VESSEL";
  return "MODULE";
}

async function loadSetupData(kind: AssessmentKind) {
  const [vesselList, locationList, auditTypeList, typeList, packageList, moduleList] = await Promise.all([
    vessels.list({ status: "ACTIVE" }),
    locations.list({ activeOnly: true }),
    auditTypes.list({ activeOnly: true }),
    vesselTypes.list(),
    packages.list(),
    modulesFor(kind),
  ]);
  return {
    vessels: vesselList,
    locations: locationList,
    auditTypes: auditTypeList,
    vesselTypes: typeList,
    packages: packageList,
    modules: moduleList,
  };
}

/** /assess/new?module=<moduleId> | start-work | full-vessel */
export function AssessmentSetup() {
  const param = useSearchParams().get("module") ?? "";
  const kind = kindFromParam(param);
  const data = useRepoQuery(["assessment-setup", kind], () => loadSetupData(kind));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <BackLink href="/" label="Back to the hub" />
      <QueryState query={data} skeletonRows={4}>
        {(setup) => <SetupForm kind={kind} param={param} setup={setup} />}
      </QueryState>
    </div>
  );
}

type SetupData = Awaited<ReturnType<typeof loadSetupData>>;

function SetupForm({ kind, param, setup }: { kind: AssessmentKind; param: string; setup: SetupData }) {
  const user = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  const allowedAuditTypes = allowedAuditTypesFor(user.role, kind, setup.auditTypes);
  const [values, setValues] = useState<AssessmentSetupValues>(() => ({
    kind,
    moduleId: kind === "MODULE" ? param : kind === "START_WORK" ? (setup.modules[0]?.id ?? "") : "",
    vesselId: "",
    locationId: "",
    auditTypeId: allowedAuditTypes.length === 1 ? allowedAuditTypes[0].id : "",
    taskDescription: "",
    teamSize: undefined,
  }));
  // Typed text for the team size; converted to a number (or left undefined) for validation.
  const [teamSizeText, setTeamSizeText] = useState("");
  const [errors, setErrors] = useState<FieldErrors<AssessmentSetupValues>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const begin = useMutation({
    mutationFn: (v: AssessmentSetupValues) => startAssessment(user, v),
    onSuccess: async (assessment) => {
      await queryClient.invalidateQueries({ queryKey: ["assessments"] });
      toast.success(`Draft ${assessment.reference} started`);
      router.push(`/assess/${assessment.id}`);
    },
  });

  const nameOf = (items: { id: string; name: string }[], id: string) => items.find((i) => i.id === id)?.name ?? "";
  const vesselOptions: VesselOption[] = setup.vessels.map((v) => ({
    id: v.id,
    name: v.name,
    detail: `${nameOf(setup.vesselTypes, v.vesselTypeId)} · ${nameOf(setup.packages, v.packageId)}`,
  }));
  const vessel = setup.vessels.find((v) => v.id === values.vesselId);
  const moduleIds = kind === "FULL_VESSEL" ? setup.modules.map((m) => m.id) : values.moduleId ? [values.moduleId] : [];
  const singleModule = kind === "MODULE" ? setup.modules.find((m) => m.id === param) : undefined;

  const counts = useRepoQuery(
    ["questions", "count", moduleIds, vessel?.vesselTypeId, values.auditTypeId],
    () => countApplicableQuestions({ moduleIds, vesselTypeId: vessel!.vesselTypeId, auditTypeId: values.auditTypeId }),
    { enabled: !!vessel && !!values.auditTypeId && moduleIds.length > 0 },
  );
  const totalQuestions = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : null;

  if (kind === "MODULE" && !singleModule) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>This module isn&apos;t available</AlertTitle>
        <AlertDescription>It may have been deactivated. Go back to the hub and choose another.</AlertDescription>
      </Alert>
    );
  }

  function chooseVessel(vesselId: string) {
    const chosen = setup.vessels.find((v) => v.id === vesselId);
    const defaultIsActive = setup.locations.some((l) => l.id === chosen?.defaultLocationId);
    setValues((v) => ({ ...v, vesselId, locationId: defaultIsActive ? chosen!.defaultLocationId : "" }));
    setErrors((e) => ({ ...e, vesselId: undefined, locationId: undefined }));
  }

  function changeTeamSize(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    setTeamSizeText(digits);
    setValues((v) => ({ ...v, teamSize: digits === "" ? undefined : Number(digits) }));
    setErrors((e) => ({ ...e, teamSize: undefined }));
  }

  const stepTeamSize = (step: number) => {
    const current = values.teamSize ?? 0;
    const next = Math.min(TEAM_SIZE_RANGE.max, Math.max(TEAM_SIZE_RANGE.min, current + step));
    changeTeamSize(String(next));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    try {
      await begin.mutateAsync(values);
    } catch (error) {
      if (error instanceof ValidationError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors as FieldErrors<AssessmentSetupValues>);
      } else {
        setFormError(errorMessage(error));
      }
    }
  }

  const title = kind === "MODULE" ? singleModule!.name : KIND_LABELS[kind];
  const subtitle =
    kind === "FULL_VESSEL"
      ? `All ${setup.modules.length} assurance modules in one assessment.`
      : kind === "START_WORK"
        ? "Confirm it is safe to start before the job begins."
        : singleModule!.description;

  const vesselDefaultLocation = vessel && setup.locations.find((l) => l.id === vessel.defaultLocationId);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            kind === "START_WORK" ? "bg-teal text-teal-foreground" : kind === "FULL_VESSEL" ? "bg-navy text-teal" : "bg-accent text-accent-foreground",
          )}
        >
          {kind === "START_WORK" ? (
            <HardHat className="size-6" aria-hidden />
          ) : kind === "FULL_VESSEL" ? (
            <Ship className="size-6" aria-hidden />
          ) : (
            <ModuleIcon moduleId={singleModule!.id} className="size-6" />
          )}
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New {KIND_LABELS[kind]}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </header>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not start the assessment</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-2xl border bg-card p-4">
        {kind === "START_WORK" && (
          <FormField id="moduleId" label="Which task?" error={errors.moduleId}>
            <NativeSelect
              {...fieldA11y("moduleId", errors.moduleId)}
              value={values.moduleId}
              onChange={(e) => setValues({ ...values, moduleId: e.target.value })}
            >
              {setup.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}

        {kind === "START_WORK" && (
          <>
            <FormField
              id="taskDescription"
              label="Job description"
              error={errors.taskDescription}
              hint="What is the team about to do? e.g. “Replace hydraulic hose on deck crane 2”"
            >
              <Textarea
                {...fieldA11y("taskDescription", errors.taskDescription)}
                rows={2}
                maxLength={TASK_DESCRIPTION_LENGTH.max}
                value={values.taskDescription}
                onChange={(e) => {
                  setValues({ ...values, taskDescription: e.target.value });
                  setErrors((er) => ({ ...er, taskDescription: undefined }));
                }}
                className="min-h-16 text-base"
              />
            </FormField>

            <FormField id="teamSize" label="People in the team" error={errors.teamSize}>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="size-11 shrink-0"
                  onClick={() => stepTeamSize(-1)}
                  disabled={(values.teamSize ?? 0) <= TEAM_SIZE_RANGE.min}
                  aria-label="One fewer person"
                >
                  <Minus />
                </Button>
                <Input
                  {...fieldA11y("teamSize", errors.teamSize)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="0"
                  value={teamSizeText}
                  onChange={(e) => changeTeamSize(e.target.value)}
                  className="h-11 w-20 text-center text-lg font-semibold tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="size-11 shrink-0"
                  onClick={() => stepTeamSize(1)}
                  disabled={(values.teamSize ?? 0) >= TEAM_SIZE_RANGE.max}
                  aria-label="One more person"
                >
                  <Plus />
                </Button>
              </div>
            </FormField>
          </>
        )}

        <FormField id="vesselId" label="Vessel" error={errors.vesselId}>
          <VesselPicker
            id="vesselId"
            vessels={vesselOptions}
            value={values.vesselId}
            onChange={chooseVessel}
            invalid={!!errors.vesselId}
          />
        </FormField>

        <FormField
          id="locationId"
          label="Location"
          error={errors.locationId}
          hint={
            !vessel
              ? "Filled in from the vessel's usual location; you can change it."
              : vesselDefaultLocation
                ? values.locationId === vesselDefaultLocation.id
                  ? `${vessel.name}'s usual location. Change it if the vessel is elsewhere.`
                  : `${vessel.name} is usually at ${vesselDefaultLocation.name}.`
                : `${vessel.name}'s usual location is no longer active. Choose where it is now.`
          }
        >
          <NativeSelect
            {...fieldA11y("locationId", errors.locationId)}
            value={values.locationId}
            onChange={(e) => setValues({ ...values, locationId: e.target.value })}
          >
            <option value="" disabled>
              Choose a location
            </option>
            {setup.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        {kind === "START_WORK" ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Audit type</p>
            <p className="flex h-11 items-center gap-2 rounded-lg border bg-muted px-3 text-sm">
              <Lock className="size-4 text-muted-foreground" aria-hidden />
              {allowedAuditTypes[0]?.name ?? "Start Work Check"}
            </p>
            {allowedAuditTypes.length === 0 && (
              <p className="text-sm text-destructive">The Start Work Check audit type is not available to your role.</p>
            )}
          </div>
        ) : (
          <FormField
            id="auditTypeId"
            label="Audit type"
            error={errors.auditTypeId}
            hint={allowedAuditTypes.length === 1 ? "The only audit type available to your role." : undefined}
          >
            <NativeSelect
              {...fieldA11y("auditTypeId", errors.auditTypeId)}
              value={values.auditTypeId}
              onChange={(e) => setValues({ ...values, auditTypeId: e.target.value })}
            >
              <option value="" disabled>
                Choose an audit type
              </option>
              {allowedAuditTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <ListChecks className="size-4 text-teal" aria-hidden />
        {!vessel || !values.auditTypeId
          ? "Choose a vessel and audit type to see how many questions apply."
          : counts.isPending
            ? "Counting questions…"
            : totalQuestions === 0
              ? "No questions apply to this vessel and audit type."
              : `${totalQuestions} question${totalQuestions === 1 ? "" : "s"} apply to ${vessel.name}.`}
      </p>

      <div className="flex gap-2">
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-12 flex-1")}>
          Cancel
        </Link>
        <Button type="submit" className="h-12 flex-[2] text-base" disabled={begin.isPending || totalQuestions === 0}>
          <Play /> {begin.isPending ? "Starting…" : "Begin"}
        </Button>
      </div>
    </form>
  );
}
