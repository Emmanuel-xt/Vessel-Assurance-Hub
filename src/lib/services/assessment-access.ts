// Who may open or change an assessment. Shared by the assessment and finding services.

import { assessments, RepositoryError } from "@/lib/data";
import {
  PermissionError,
  canEditAssessment,
  canViewAssessment,
  requireUser,
  type Principal,
} from "@/lib/services/permissions";
import type { Assessment, ID } from "@/lib/types";

/** The assessment if the actor may see it. Missing and forbidden look the same, so ids cannot be probed. */
export async function getAssessmentForUser(actor: Principal, id: ID): Promise<Assessment> {
  const user = requireUser(actor);
  const assessment = await assessments.get(id);
  if (!assessment || !canViewAssessment(user, assessment)) {
    throw new RepositoryError("NOT_FOUND", "This assessment doesn't exist or you don't have access to it.");
  }
  return assessment;
}

/** Loads a draft the actor may edit, or throws. */
export async function requireEditableDraft(actor: Principal, assessmentId: ID): Promise<Assessment> {
  const user = requireUser(actor);
  const assessment = await getAssessmentForUser(user, assessmentId);
  if (assessment.status !== "DRAFT") {
    throw new RepositoryError("CONFLICT", "This assessment has been submitted and can no longer be changed.");
  }
  if (!canEditAssessment(user, assessment)) {
    throw new PermissionError("FORBIDDEN", "Only the person who started this assessment can answer it.");
  }
  return assessment;
}
