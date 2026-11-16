"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, HardHat, Minus, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { BackLink } from "@/components/admin/page-header";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { VesselPicker, type VesselOption } from "@/components/assess/vessel-picker";
import { FormField, fieldA11y } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { locations, packages, vessels, vesselTypes } from "@/lib/data";
import { useRepoMutation, useRepoQuery } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";
import { modulesFor } from "@/lib/services/assessments";
import { ValidationError } from "@/lib/services/errors";
import {
  TASK_DESCRIPTION_LENGTH,
  TEAM_SIZE_RANGE,
  createActivity,
  type ActivitySetupValues,
} from "@/lib/services/start-work-activities";
import { cn } from "@/lib/utils";
import type { FieldErrors } from "@/lib/validation/common";

async function loadSetupData() {
  const [vesselList, locationList, typeList, packageList, tasks] = await Promise.all([
    vessels.list({ status: "ACTIVE" }),
    locations.list({ activeOnly: true }),
    vesselTypes.list(),
    packages.list(),
    modulesFor("START_WORK"),
  ]);
  return { vessels: vesselList, locations: locationList, vesselTypes: typeList, packages: packageList, tasks };
}

type SetupData = Awaited<ReturnType<typeof loadSetupData>>;

/** /start-work/new: an Auditor (or Admin) sets up a Start Work Check for a job; the crew then join it. */
export function ActivitySetup() {
  const data = useRepoQuery(["start-work-setup"], loadSetupData);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <BackLink href="/start-work" label="Back to Start Work Checks" />
      <QueryState query={data} skeletonRows={4}>
        {(setup) =>
          setup.tasks.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>No Start Work tasks are active</AlertTitle>
              <AlertDescription>Activate a Start Work module in Admin → Modules first.</AlertDescription>
            </Alert>
          ) : (
            <SetupForm setup={setup} />
          )
        }
      </QueryState>
    </div>
  );
}

function SetupForm({ setup }: { setup: SetupData }) {
  const user = useCurrentUser();
  const router = useRouter();
  const [values, setValues] = useState<ActivitySetupValues>({
    moduleId: setup.tasks[0].id,
    vesselId: "",
    locationId: "",
    taskDescription: "",
    teamSize: 2,
  });
  const [teamSizeText, setTeamSizeText] = useState("2");
  const [errors, setErrors] = useState<FieldErrors<ActivitySetupValues>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const create = useRepoMutation((v: ActivitySetupValues) => createActivity(user, v), {
    invalidates: [["startWorkActivities"]],
    onSuccess: (activity) => {
      toast.success(`${activity.reference} is open - share the code with the crew`);
      router.push(`/start-work/${activity.id}`);
    },
  });

  const nameOf = (items: { id: string; name: string }[], id: string) => items.find((i) => i.id === id)?.name ?? "";
  const vesselOptions: VesselOption[] = setup.vessels.map((v) => ({
    id: v.id,
    name: v.name,
    detail: `${nameOf(setup.vesselTypes, v.vesselTypeId)} · ${nameOf(setup.packages, v.packageId)}`,
  }));
  const vessel = setup.vessels.find((v) => v.id === values.vesselId);

  function chooseVessel(vesselId: string) {
    const chosen = setup.vessels.find((v) => v.id === vesselId);
    const defaultIsActive = setup.locations.some((l) => l.id === chosen?.defaultLocationId);
    setValues((v) => ({ ...v, vesselId, locationId: defaultIsActive ? chosen!.defaultLocationId : "" }));
    setErrors((e) => ({ ...e, vesselId: undefined, locationId: undefined }));
  }

  function changeTeamSize(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    setTeamSizeText(digits);
    setValues((v) => ({ ...v, teamSize: digits === "" ? Number.NaN : Number(digits) }));
    setErrors((e) => ({ ...e, teamSize: undefined }));
  }

  const stepTeamSize = (step: number) => {
    const current = Number.isFinite(values.teamSize) ? values.teamSize : 0;
    changeTeamSize(String(Math.min(TEAM_SIZE_RANGE.max, Math.max(TEAM_SIZE_RANGE.min, current + step))));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    try {
      await create.mutateAsync(values);
    } catch (error) {
      if (error instanceof ValidationError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors as FieldErrors<ActivitySetupValues>);
      } else {
        setFormError(errorMessage(error));
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal text-teal-foreground">
          <HardHat className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New Start Work Check</p>
          <h1 className="text-2xl font-semibold tracking-tight">Set up a check for the crew</h1>
          <p className="text-sm text-muted-foreground">
            You get a join code, link and QR code. Each person in the team joins and answers their own check.
          </p>
        </div>
      </header>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not set up the check</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-2xl border bg-card p-4">
        <FormField id="moduleId" label="Which task?" error={errors.moduleId}>
          <NativeSelect
            {...fieldA11y("moduleId", errors.moduleId)}
            value={values.moduleId}
            onChange={(e) => setValues({ ...values, moduleId: e.target.value })}
          >
            {setup.tasks.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>

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

        <FormField
          id="teamSize"
          label="People taking part"
          error={errors.teamSize}
          hint="Each of them joins and answers. Joining closes once this many have joined."
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="size-11 shrink-0"
              onClick={() => stepTeamSize(-1)}
              disabled={!(values.teamSize > TEAM_SIZE_RANGE.min)}
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
              disabled={values.teamSize >= TEAM_SIZE_RANGE.max}
              aria-label="One more person"
            >
              <Plus />
            </Button>
          </div>
        </FormField>

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
          hint={vessel ? "Filled in from the vessel's usual location; change it if the vessel is elsewhere." : undefined}
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
      </div>

      <div className="flex gap-2">
        <Link href="/start-work" className={cn(buttonVariants({ variant: "outline" }), "h-12 flex-1")}>
          Cancel
        </Link>
        <Button type="submit" className="h-12 flex-[2] text-base" disabled={create.isPending}>
          <Play /> {create.isPending ? "Opening…" : "Open the check"}
        </Button>
      </div>
    </form>
  );
}
