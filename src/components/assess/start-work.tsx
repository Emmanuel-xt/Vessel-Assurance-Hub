import { CheckCircle2, ClipboardList, MessageSquare, OctagonX, Users } from "lucide-react";
import type { ID, Question, Response, StartWorkDetails } from "@/lib/types";

export const teamLabel = (size: number) => `${size} ${size === 1 ? "person" : "people"}`;

/** "Job: … · 4 people" line for Start Work Checks. */
export function StartWorkDetailsLine({ details }: { details: StartWorkDetails }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <ClipboardList className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Job:</span> {details.taskDescription}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Users className="size-4 shrink-0" aria-hidden /> {teamLabel(details.teamSize)}
      </span>
    </p>
  );
}

/**
 * Start Work Check result: a STOP banner listing every "No" item (with its comment),
 * or an all-clear message when nothing was answered No.
 */
export function StopWorkBanner({
  items,
  responses,
}: {
  items: Pick<Question, "id" | "text">[];
  responses: Record<ID, Pick<Response, "comment"> | undefined>;
}) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        All clear: no items were answered No.
      </p>
    );
  }
  return (
    <section role="alert" className="space-y-3 rounded-2xl border-2 border-red-700 bg-red-600 p-4 text-white">
      <h2 className="flex items-start gap-2 text-lg leading-snug font-bold">
        <OctagonX className="mt-0.5 size-6 shrink-0" aria-hidden />
        STOP - resolve the No items before starting work
      </h2>
      <ol className="space-y-2 rounded-xl bg-white p-3 text-sm text-foreground">
        {items.map((question, index) => {
          const comment = responses[question.id]?.comment;
          return (
            <li key={question.id} className="flex gap-2">
              <span className="w-5 shrink-0 font-semibold text-red-700">{index + 1}.</span>
              <div className="space-y-0.5">
                <p className="font-medium">{question.text}</p>
                {comment && (
                  <p className="flex gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {comment}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
