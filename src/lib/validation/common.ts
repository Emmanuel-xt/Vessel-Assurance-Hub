// Shared helpers for turning Zod errors into per-field form messages.

import { z } from "zod";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First error message per field, ready to show under each input. */
export function fieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flat).flatMap(([field, messages]) => (messages?.[0] ? [[field, messages[0]]] : [])),
  ) as FieldErrors<T>;
}
