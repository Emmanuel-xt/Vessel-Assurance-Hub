// Reference number rules (CLAUDE.md §15). Pure functions: the sequence itself is kept by the data layer.

export const REFERENCE_PREFIX = {
  assessment: "VAH-A",
  finding: "VAH-F",
  positiveIntervention: "VAH-P",
} as const;

export type ReferenceKind = keyof typeof REFERENCE_PREFIX;

/** Operations run on West Africa Time, so the reference year follows Lagos, not UTC. */
export const BUSINESS_TIME_ZONE = "Africa/Lagos";

export function referenceYear(date: Date): number {
  const year = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, year: "numeric" }).format(date);
  return Number(year);
}

/** Counter key: one sequence per kind per year, restarting at 1 each year. */
export function sequenceKey(kind: ReferenceKind, year: number): string {
  return `${REFERENCE_PREFIX[kind]}-${year}`;
}

/** e.g. formatReference("finding", 2026, 42) → "VAH-F-2026-0042" */
export function formatReference(kind: ReferenceKind, year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid reference sequence: ${sequence}`);
  }
  return `${sequenceKey(kind, year)}-${String(sequence).padStart(4, "0")}`;
}

/** e.g. formatActionReference("VAH-F-2026-0042", 1) → "VAH-F-2026-0042-A1" */
export function formatActionReference(findingReference: string, actionNumber: number): string {
  if (!Number.isInteger(actionNumber) || actionNumber < 1) {
    throw new Error(`Invalid action number: ${actionNumber}`);
  }
  return `${findingReference}-A${actionNumber}`;
}
