"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Eye, Home, Sparkles } from "lucide-react";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { QueryState } from "@/components/query-state";
import { buttonVariants } from "@/components/ui/button";
import { positiveInterventions } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { KIND_LABELS, loadAssessmentForm, stopWorkItems } from "@/lib/services/assessments";
import type { PublicUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScorePanel } from "./score-panel";
import { RaisedFindings } from "./findings/finding-summaries";
import { StartWorkDetailsLine, StopWorkBanner } from "./start-work";

async function loadConfirmation(user: PublicUser, id: string) {
  const [form, interventions] = await Promise.all([
    loadAssessmentForm(user, id),
    positiveInterventions.list({ assessmentId: id }),
  ]);
  return { ...form, positiveInterventionCount: interventions.length };
}

/** /assess/[id]/submitted: confirmation with reference number and score. */
export function AssessmentSubmitted() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const query = useRepoQuery(["assessments", id, "submitted"], () => loadConfirmation(user, id), { refetchOnMount: "always" });

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <QueryState query={query} skeletonRows={3} notFound="assessment">
        {({ assessment, sections, responses, positiveInterventionCount }) =>
          assessment.status !== "SUBMITTED" ? (
            <p className="text-center text-sm text-muted-foreground">
              This assessment hasn&apos;t been submitted yet.{" "}
              <Link href={`/assess/${assessment.id}`} className="text-teal underline underline-offset-4">
                Continue it
              </Link>
            </p>
          ) : (
            <>
              <div className="space-y-2 text-center">
                <CheckCircle2 className="mx-auto size-14 text-emerald-600" aria-hidden />
                <h1 className="text-2xl font-semibold tracking-tight">Assessment submitted</h1>
                <p className="text-sm text-muted-foreground">
                  {assessment.kind === "MODULE" ? sections[0]?.module.name : KIND_LABELS[assessment.kind]} ·{" "}
                  {assessment.snapshot.vesselName}
                </p>
                <p className="font-mono text-lg font-semibold text-teal">{assessment.reference}</p>
                {assessment.startWork && (
                  <div className="flex justify-center">
                    <StartWorkDetailsLine details={assessment.startWork} />
                  </div>
                )}
              </div>

              {assessment.kind === "START_WORK" && (
                <StopWorkBanner items={stopWorkItems(sections, responses)} responses={responses} />
              )}

              <ScorePanel scores={{ overall: assessment.overallScore, byModule: assessment.moduleScores }} sections={sections} />

              <RaisedFindings assessmentId={assessment.id} />

              {positiveInterventionCount > 0 && (
                <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <Sparkles className="size-4" aria-hidden />
                  {positiveInterventionCount} Good Practice observation{positiveInterventionCount === 1 ? "" : "s"} recorded.
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/" className={cn(buttonVariants(), "h-12 text-base sm:flex-1")}>
                  <Home /> Back to hub
                </Link>
                <Link href={`/assessments/${assessment.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-12 sm:flex-1")}>
                  <Eye /> View answers
                </Link>
              </div>
            </>
          )
        }
      </QueryState>
    </div>
  );
}
