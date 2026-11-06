import type { z } from "zod";
import { fieldErrors, type FieldErrors } from "@/lib/validation/common";

/** Input failed validation. Carries one message per field so forms can show them inline. */
export class ValidationError<T = Record<string, unknown>> extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: FieldErrors<T> = {},
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Parses input with a Zod schema, throwing a ValidationError with per-field messages on failure. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Please fix the highlighted fields.", fieldErrors(result.error));
  }
  return result.data;
}
