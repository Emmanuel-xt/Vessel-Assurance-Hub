"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  HardHat,
  Lock,
  LogIn,
  OctagonX,
  Share2,
  Ship,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { BackLink } from "@/components/admin/page-header";
import { ScoreValue } from "@/components/assess/score-value";
import { teamLabel } from "@/components/assess/start-work";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { QueryState } from "@/components/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRepoMutation, useRepoQuery } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { formatJoinCode } from "@/lib/services/join-codes";
import {
  CLOSURE_COMMENT_MAX_LENGTH,
  closeActivity,
  joinActivity,
  loadActivity,
  verifyParticipant,
  type ActivityDetail,
  type ActivityParticipant,
} from "@/lib/services/start-work-activities";
import { cn } from "@/lib/utils";
import { JoinQr } from "./join-qr";

/** /start-work/[id]: the Start Work Check itself. The join link and QR code point here. */
export function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const detail = useRepoQuery(["startWorkActivities", id, "detail", user.id], () => loadActivity(user, id));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/start-work" label="All Start Work Checks" />
      <QueryState query={detail} skeletonRows={4} notFound="Start Work Check">
        {(data) => <ActivityView data={data} />}
      </QueryState>
    </div>
  );
}

function ActivityView({ data }: { data: ActivityDetail }) {
  const { activity, participants } = data;
  const isOpen = activity.status === "OPEN";
  const stops = participants.filter((p) => p.noCount > 0);
  const placesLeft = Math.max(0, activity.teamSize - data.joined);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            isOpen ? "bg-teal text-teal-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <HardHat className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Start Work Check · {activity.reference}
            <Badge className={isOpen ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground"}>
              {isOpen ? "Open" : "Closed"}
            </Badge>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{data.taskName}</h1>
          <p className="flex items-start gap-1.5 text-sm">
            <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="sr-only">Job: </span>
              {activity.taskDescription}
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Ship className="size-4" aria-hidden /> {activity.snapshot.vesselName} · {data.locationName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden /> {teamLabel(activity.teamSize)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Set up by {data.createdByName} · {formatDateTime(activity.createdAt)}
          </p>
        </div>
      </header>

      {!isOpen && (
        <Alert>
          <Lock />
          <AlertTitle>
            Closed by {data.closedByName ?? "the auditor"}
            {activity.closedAt && ` · ${formatDateTime(activity.closedAt)}`}
          </AlertTitle>
          <AlertDescription>
            {activity.closureComment ?? "No more joining or submitting on this check."}
          </AlertDescription>
        </Alert>
      )}

      <MyPart data={data} />

      {isOpen && <ShareCard data={data} />}

      {stops.length > 0 && (
        <Alert variant="destructive">
          <OctagonX />
          <AlertTitle>
            STOP - {stops.length} {stops.length === 1 ? "person" : "people"} answered No
          </AlertTitle>
          <AlertDescription>Resolve the Non-Compliant items before the job starts. Open each check to see them.</AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="team-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="team-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Team
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.joined} of {activity.teamSize} joined · {data.submitted} submitted
            {data.submitted > 0 && ` · ${data.submitted - data.unverified} verified`}
            {isOpen && placesLeft > 0 && ` · ${placesLeft} ${placesLeft === 1 ? "place" : "places"} left`}
          </p>
        </div>
        {participants.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Nobody has joined yet. {isOpen && "Share the code, link or QR code with the crew."}
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {participants.map((p) => (
              <ParticipantRow key={p.assessment.id} participant={p} activityOpen={isOpen} activityReference={activity.reference} />
            ))}
          </ul>
        )}
      </section>

      {data.canClose && <CloseCard data={data} />}
    </div>
  );
}

/** The viewer's own part: join, continue or view their check. */
function MyPart({ data }: { data: ActivityDetail }) {
  const user = useCurrentUser();
  const router = useRouter();
  const { activity, mine, joinBlock } = data;
  const join = useRepoMutation(() => joinActivity(user, activity.id), {
    invalidates: [["startWorkActivities"], ["assessments"]],
    onSuccess: (assessment) => {
      toast.success(`Joined ${activity.reference}`);
      router.push(`/assess/${assessment.id}`);
    },
  });

  if (mine) {
    const draft = mine.status === "DRAFT";
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-accent/40 p-4">
        <p className="text-sm">
          {draft
            ? activity.status === "OPEN"
              ? "You joined this check. Answer the questions and submit before the job starts."
              : "This check was closed before you submitted."
            : `You submitted your check (${mine.reference}).`}
        </p>
        <Link
          href={draft && activity.status === "OPEN" ? `/assess/${mine.id}` : `/assessments/${mine.id}`}
          className={cn(buttonVariants({ variant: draft ? "default" : "outline" }), "h-11")}
        >
          {draft && activity.status === "OPEN" ? "Continue my check" : "View my check"}
        </Link>
      </div>
    );
  }
  if (activity.status === "CLOSED" || data.isCreator) return null;
  if (joinBlock) {
    return <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{joinBlock}</p>;
  }
  return (
    <Button
      className="h-14 w-full text-base"
      disabled={join.isPending}
      onClick={() => join.mutateAsync().catch((e) => toast.error(errorMessage(e)))}
    >
      <LogIn /> {join.isPending ? "Joining…" : "Join this Start Work Check"}
    </Button>
  );
}

/** Code, link and QR code for the crew. */
function ShareCard({ data }: { data: ActivityDetail }) {
  const { activity } = data;
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}/start-work/${activity.id}`);
    setCanShare(typeof navigator.share === "function");
  }, [activity.id]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy it.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Start Work Check ${activity.reference}`,
        text: `Join the Start Work Check for "${activity.taskDescription}" (code ${formatJoinCode(activity.code)})`,
        url,
      });
    } catch {
      // Cancelled by the user: nothing to do.
    }
  }

  return (
    <section aria-labelledby="share-heading" className="space-y-4 rounded-2xl border bg-card p-4">
      <h2 id="share-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Join this check
      </h2>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {url && <JoinQr url={url} label={`QR code to join ${activity.reference}`} />}
        <div className="w-full min-w-0 space-y-3 text-center sm:text-left">
          <div>
            <p className="text-xs text-muted-foreground">Code</p>
            <p className="font-mono text-4xl font-bold tracking-widest" aria-label={`Code ${activity.code.split("").join(" ")}`}>
              {formatJoinCode(activity.code)}
            </p>
            <p className="text-xs text-muted-foreground">Enter it under Start Work Check on the hub, or scan the QR code.</p>
          </div>
          <p className="break-all text-xs text-muted-foreground">{url}</p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button variant="outline" className="h-11" onClick={copy} disabled={!url}>
              <Copy /> Copy link
            </Button>
            {canShare && (
              <Button variant="outline" className="h-11" onClick={share}>
                <Share2 /> Share
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ParticipantRow({
  participant,
  activityOpen,
  activityReference,
}: {
  participant: ActivityParticipant;
  activityOpen: boolean;
  activityReference: string;
}) {
  const user = useCurrentUser();
  const { assessment, noCount, canOpen, canVerify } = participant;
  const [confirming, setConfirming] = useState(false);
  const verify = useRepoMutation(() => verifyParticipant(user, assessment.id), {
    invalidates: [["startWorkActivities"], ["assessments"]],
    onSuccess: () => toast.success(`${assessment.snapshot.userName}'s check verified`),
  });
  const submitted = assessment.status === "SUBMITTED";
  const verification = assessment.verification;

  const person = (
    <span className="min-w-0 flex-1">
      <span className="block font-medium">{assessment.snapshot.userName}</span>
      <span className="block text-xs text-muted-foreground">
        {assessment.snapshot.position} · {assessment.snapshot.company}
      </span>
    </span>
  );
  const status = submitted ? (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {noCount > 0 ? (
        <Badge variant="destructive">
          <OctagonX /> STOP · {noCount} No
        </Badge>
      ) : (
        <Badge className="bg-emerald-700 text-white">
          <CheckCircle2 /> All clear
        </Badge>
      )}
      <ScoreValue score={assessment.overallScore} layout="inline" className="text-sm font-semibold" />
    </span>
  ) : (
    <Badge variant="secondary">{activityOpen ? "Answering…" : "Not submitted"}</Badge>
  );

  return (
    <li className="px-4 py-2">
      {submitted && canOpen ? (
        <Link
          href={`/assessments/${assessment.id}`}
          className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {person}
          {status}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : (
        <div className="flex min-h-12 items-center gap-3">
          {person}
          {status}
        </div>
      )}
      {verification ? (
        <p className="flex items-center gap-1.5 pb-1 text-xs font-medium text-emerald-800">
          <BadgeCheck className="size-4" aria-hidden /> Verified by {verification.verifiedByName} ·{" "}
          {formatDateTime(verification.verifiedAt)}
        </p>
      ) : (
        canVerify && (
          <div className="flex justify-end pb-1">
            <Button variant="outline" className="h-11" onClick={() => setConfirming(true)} disabled={verify.isPending}>
              <BadgeCheck /> Verify
            </Button>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={`Verify ${assessment.snapshot.userName}'s check?`}
              description={
                noCount > 0
                  ? `${noCount} ${noCount === 1 ? "item was" : "items were"} answered No. Make sure ${noCount === 1 ? "it is" : "they are"} resolved before you verify. Your name and the time are recorded on ${activityReference}.`
                  : `You confirm the controls on this check are in place. Your name and the time are recorded on ${activityReference}.`
              }
              confirmLabel="Verify"
              onConfirm={() =>
                verify.mutateAsync().catch((e) => {
                  toast.error(errorMessage(e));
                  throw e;
                })
              }
            />
          </div>
        )
      )}
    </li>
  );
}

/** Auditor / Admin: close the check once the team has answered (or the job is cancelled). */
function CloseCard({ data }: { data: ActivityDetail }) {
  const user = useCurrentUser();
  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState(false);
  const close = useRepoMutation(() => closeActivity(user, data.activity.id, comment), {
    invalidates: [["startWorkActivities"], ["assessments"]],
    onSuccess: (activity) => toast.success(`${activity.reference} closed`),
  });
  const pending = data.joined - data.submitted;
  const stops = data.participants.filter((p) => p.noCount > 0).length;
  const blocked = data.unverified > 0;

  return (
    <section aria-labelledby="close-heading" className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 id="close-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Verify &amp; close
      </h2>
      <p className="text-sm text-muted-foreground">
        As Start-Work Verifier, verify each submitted check, then close the job. Closing stops anyone else joining or
        submitting; who closed it and when is recorded.
      </p>
      <label htmlFor="closureComment" className="block text-sm font-medium">
        Comment <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id="closureComment"
        rows={2}
        maxLength={CLOSURE_COMMENT_MAX_LENGTH}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="e.g. All checks in, toolbox talk done. Cleared to start."
        className="text-base"
      />
      <Button
        variant="outline"
        className="h-11 w-full sm:w-auto"
        onClick={() => setConfirming(true)}
        disabled={blocked}
        aria-describedby={blocked ? "close-blocked" : undefined}
      >
        <Lock /> Verify &amp; close
      </Button>
      {blocked && (
        <p id="close-blocked" className="text-sm text-amber-800">
          Verify the {data.unverified} submitted {data.unverified === 1 ? "check" : "checks"} above first.
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Close ${data.activity.reference}?`}
        description={[
          `${data.submitted} of ${data.activity.teamSize} people submitted.`,
          pending > 0 ? `${pending} still answering will not be able to submit.` : "",
          stops > 0 ? `${stops} answered No: make sure those items are resolved.` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel="Close check"
        onConfirm={() =>
          close.mutateAsync().catch((e) => {
            toast.error(errorMessage(e));
            throw e;
          })
        }
      />
    </section>
  );
}
