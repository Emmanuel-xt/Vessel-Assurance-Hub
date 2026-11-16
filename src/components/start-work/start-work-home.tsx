"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, HardHat, KeyRound, LogIn, Plus, Ship, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { FormField, fieldA11y } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRepoMutation, useRepoQuery } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ValidationError } from "@/lib/services/errors";
import { JOIN_CODE_LENGTH, formatJoinCode } from "@/lib/services/join-codes";
import { canInitiateStartWork } from "@/lib/services/permissions";
import {
  findActivityByCode,
  joinActivity,
  listActivities,
  type ActivitySummary,
} from "@/lib/services/start-work-activities";
import { cn } from "@/lib/utils";

/** /start-work: join a Start Work Check (code or open list); auditors and admins also set them up here. */
export function StartWorkHome() {
  const user = useCurrentUser();
  const initiator = canInitiateStartWork(user);
  const [vesselId, setVesselId] = useState("");
  const open = useRepoQuery(["startWorkActivities", "open", user.id], () => listActivities(user, { status: "OPEN" }));
  const closed = useRepoQuery(
    ["startWorkActivities", "closed", user.id],
    () => listActivities(user, { status: "CLOSED", mine: user.role === "AUDITOR" }),
    { enabled: initiator },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/", label: "Back to the hub" }}
        title="Start Work Checks"
        description={
          initiator
            ? "Set up a check for a job, share the code, and close it once everyone has answered."
            : "Join the check your auditor set up for the job: enter the code, scan the QR code, or pick it below."
        }
        actions={
          initiator && (
            <Link href="/start-work/new" className={cn(buttonVariants(), "h-11")}>
              <Plus /> New Start Work Check
            </Link>
          )
        }
      />

      <JoinByCode />

      <section aria-labelledby="open-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="open-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Open checks
          </h2>
          {open.data && open.data.length > 0 && (
            <NativeSelect
              aria-label="Filter by vessel"
              className="w-full sm:w-64"
              value={vesselId}
              onChange={(e) => setVesselId(e.target.value)}
            >
              <option value="">All vessels</option>
              {[...new Map(open.data.map((s) => [s.activity.vesselId, s.activity.snapshot.vesselName]))]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </NativeSelect>
          )}
        </div>
        <QueryState query={open} skeletonRows={2}>
          {(list) => {
            const shown = list.filter((s) => !vesselId || s.activity.vesselId === vesselId);
            return shown.length === 0 ? (
              <EmptyState icon={HardHat} title="No open Start Work Checks">
                {initiator
                  ? "Set one up for the next job with “New Start Work Check”."
                  : "Your auditor sets one up before the job starts. Ask them for the code."}
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {shown.map((summary) => (
                  <li key={summary.activity.id}>
                    <ActivityCard summary={summary} />
                  </li>
                ))}
              </ul>
            );
          }}
        </QueryState>
      </section>

      {initiator && (
        <section aria-labelledby="closed-heading" className="space-y-3">
          <h2 id="closed-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {user.role === "AUDITOR" ? "Closed - set up by you" : "Recently closed"}
          </h2>
          <QueryState query={closed} skeletonRows={2}>
            {(list) =>
              list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No closed checks yet.</p>
              ) : (
                <ul className="space-y-3">
                  {list.slice(0, 10).map((summary) => (
                    <li key={summary.activity.id}>
                      <ActivityCard summary={summary} />
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryState>
        </section>
      )}
    </div>
  );
}

/** Code entry: the fastest way in on deck. Takes you to the check so you can confirm the job before joining. */
function JoinByCode() {
  const user = useCurrentUser();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const find = useRepoMutation((value: string) => findActivityByCode(user, value), {
    onSuccess: (activity) => router.push(`/start-work/${activity.id}`),
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await find.mutateAsync(code);
    } catch (e) {
      setError(e instanceof ValidationError ? (e.fieldErrors as { code?: string }).code ?? e.message : errorMessage(e));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-teal/40 bg-accent/40 p-4">
      <FormField id="code" label="Have a code?" error={error} hint="The 6-character code from your auditor, e.g. K7P-4QX.">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              {...fieldA11y("code", error)}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(undefined);
              }}
              maxLength={JOIN_CODE_LENGTH + 2}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABC-123"
              className="h-12 pl-9 font-mono text-lg tracking-widest uppercase"
            />
          </div>
          <Button type="submit" className="h-12 px-5" disabled={find.isPending}>
            <LogIn /> {find.isPending ? "Finding…" : "Go"}
          </Button>
        </div>
      </FormField>
    </form>
  );
}

/** One Start Work Check: task, job, vessel, auditor, places, and the right button for the viewer. */
export function ActivityCard({ summary }: { summary: ActivitySummary }) {
  const user = useCurrentUser();
  const router = useRouter();
  const { activity, mine, joinBlock } = summary;
  const join = useRepoMutation(() => joinActivity(user, activity.id), {
    invalidates: [["startWorkActivities"], ["assessments"]],
    onSuccess: (assessment) => {
      toast.success(`Joined ${activity.reference}`);
      router.push(`/assess/${assessment.id}`);
    },
  });
  const isOpen = activity.status === "OPEN";

  return (
    <div className="rounded-2xl border bg-card p-4">
      <Link
        href={`/start-work/${activity.id}`}
        className="group -m-1 flex items-start gap-3 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            isOpen ? "bg-teal text-teal-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <HardHat className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{summary.taskName}</span>
            <span className="text-xs text-muted-foreground">{activity.reference}</span>
            {!isOpen && <Badge variant="secondary">Closed</Badge>}
          </span>
          <span className="block text-sm">{activity.taskDescription}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Ship className="size-3.5" aria-hidden /> {activity.snapshot.vesselName} · {summary.locationName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {summary.joined} of {activity.teamSize} joined
              {summary.submitted > 0 && ` · ${summary.submitted} submitted`}
            </span>
          </span>
          <span className="block text-xs text-muted-foreground">
            {activity.snapshot.createdByName} · {formatDateTime(isOpen ? activity.createdAt : (activity.closedAt ?? activity.createdAt))}
            {isOpen && (
              <>
                {" "}
                · code <span className="font-mono font-semibold text-foreground">{formatJoinCode(activity.code)}</span>
              </>
            )}
          </span>
        </span>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
      </Link>

      {isOpen && !summary.isCreator && (
        <div className="mt-3 flex justify-end">
          {mine ? (
            <Link
              href={mine.status === "DRAFT" ? `/assess/${mine.id}` : `/assessments/${mine.id}`}
              className={cn(buttonVariants({ variant: mine.status === "DRAFT" ? "default" : "outline" }), "h-11")}
            >
              {mine.status === "DRAFT" ? "Continue my check" : "View my check"}
            </Link>
          ) : joinBlock ? (
            <p className="text-sm text-muted-foreground">{joinBlock}</p>
          ) : (
            <Button
              className="h-11"
              disabled={join.isPending}
              onClick={() => join.mutateAsync().catch((e) => toast.error(errorMessage(e)))}
            >
              <LogIn /> {join.isPending ? "Joining…" : "Join"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
