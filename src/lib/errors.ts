import { RepositoryError } from "@/lib/data";
import { ValidationError } from "@/lib/services/errors";
import { PermissionError } from "@/lib/services/permissions";

/** A message safe to show the user for any thrown error. */
export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError || error instanceof PermissionError || error instanceof ValidationError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
