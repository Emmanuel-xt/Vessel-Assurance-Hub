// Overdue rule (CLAUDE.md §9): not closed and past the target date. Derived on read, never stored.

import { BUSINESS_TIME_ZONE } from "@/lib/services/references";
import type { ISODate, WorkStatus } from "@/lib/types";

/** Today's calendar date in Lagos, "YYYY-MM-DD". */
export function businessToday(now: Date = new Date()): ISODate {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(now);
}

/** Overdue once the target date has passed: an action due today is not yet overdue. */
export function isOverdue(item: { status: WorkStatus; targetDate: ISODate }, now: Date = new Date()): boolean {
  return item.status !== "CLOSED" && item.targetDate < businessToday(now);
}
