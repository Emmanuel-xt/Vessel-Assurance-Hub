"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { QueryState } from "@/components/query-state";
import { useRepoQuery } from "@/lib/data/hooks";
import { loadAssessmentForm } from "@/lib/services/assessments";
import { AssessmentForm } from "./assessment-form";

/** /assess/[id]: the question form for the owner's draft. Anything else opens the read-only /assessments/[id]. */
export function AssessmentScreen() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const query = useRepoQuery(["assessments", id, "form"], () => loadAssessmentForm(user, id), {
    // The form keeps its own state while open; don't refetch underneath it.
    refetchOnMount: "always",
    staleTime: Infinity,
  });

  return (
    <QueryState query={query} skeletonRows={4} notFound="assessment">
      {(form) => (form.editable ? <AssessmentForm form={form} /> : <GoToDetail id={id} />)}
    </QueryState>
  );
}

function GoToDetail({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/assessments/${id}${window.location.hash}`);
  }, [router, id]);
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Opening the assessment…
    </p>
  );
}
