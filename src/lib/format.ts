import { BUSINESS_TIME_ZONE } from "@/lib/services/references";

// Dates are shown as "dd MMM yyyy" (CLAUDE.md §15). Month names are fixed here because some ICU versions
// abbreviate September as "Sept" for en-GB.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function lagosParts(iso: string | Date) {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(typeof iso === "string" ? new Date(iso) : iso).map((p) => [p.type, p.value]),
  );
  return { day: parts.day, month: MONTHS[Number(parts.month) - 1], year: parts.year, hour: parts.hour, minute: parts.minute };
}

/** "05 Nov 2026" in Lagos time. */
export function formatDate(iso: string | Date): string {
  const p = lagosParts(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

/** "05 Nov 2026, 13:28" in Lagos time. */
export function formatDateTime(iso: string | Date): string {
  const p = lagosParts(iso);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** "12 Nov 2026" for a calendar date ("YYYY-MM-DD", e.g. a target date). Noon UTC keeps it on the same day. */
export function formatCalendarDate(date: string): string {
  return formatDate(`${date}T12:00:00Z`);
}
