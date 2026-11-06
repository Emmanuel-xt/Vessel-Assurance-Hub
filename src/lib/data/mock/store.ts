// MOCK: in-memory demo database, seeded from fixtures and saved to localStorage after every write.
// On the server (no window) it runs from fixtures in memory only; data pages are client components.

import { buildFixtures, type FixtureOptions } from "@/lib/data/fixtures";
import { LEGACY_STORAGE_KEYS, STORAGE_KEY, type DemoData, type TableName } from "./schema";

const TABLES: TableName[] = Object.keys(buildFixtures({ history: false })).filter((k): k is TableName => k !== "counters");

/** MOCK: how the demo data is seeded. Tests turn the generated history off (src/test/setup.ts). */
let fixtureOptions: FixtureOptions = {};

export function configureDemoFixtures(options: FixtureOptions): void {
  fixtureOptions = options;
}

let state: DemoData | null = null;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // e.g. storage blocked by browser settings
  }
}

function isDemoData(value: unknown): value is DemoData {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    TABLES.every((table) => Array.isArray(record[table])) &&
    typeof record.counters === "object" &&
    record.counters !== null
  );
}

/** Brings data saved by an older version up to date instead of discarding it. */
function upgrade(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  // Stage 9: Start Work details on assessments.
  if (Array.isArray(record.assessments)) {
    for (const a of record.assessments as { startWork?: unknown }[]) a.startWork ??= null;
  }
  // Stage 10: findings prepared on drafts.
  if (!Array.isArray(record.findingDrafts)) record.findingDrafts = [];
  // Stage 12: self vs supervisory audit types.
  if (Array.isArray(record.auditTypes)) {
    for (const t of record.auditTypes as { code?: string; assuranceLevel?: string }[]) {
      t.assuranceLevel ??= t.code === "SELF_ASSESSMENT" || t.code === "START_WORK_CHECK" ? "SELF" : "SUPERVISORY";
    }
  }
}

function load(): DemoData | null {
  try {
    for (const key of LEGACY_STORAGE_KEYS) storage()?.removeItem(key);
  } catch {
    // ignore: storage blocked
  }
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    upgrade(parsed);
    return isDemoData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The live demo database. Loads from localStorage on first use, or seeds from fixtures. */
export function db(): DemoData {
  if (!state) {
    const saved = load();
    state = saved ?? buildFixtures(fixtureOptions);
    if (!saved) persist();
  }
  return state;
}

export function persist(): void {
  if (!state) return;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("[MOCK] Could not save demo data to localStorage", error);
  }
}

/** Replaces all data with a fresh copy of the fixtures. */
export function resetStore(): void {
  state = buildFixtures(fixtureOptions);
  persist();
}

/** Test helper: forgets the in-memory copy so the next access reloads from localStorage, like a page reload. */
export function forgetMemoryState(): void {
  state = null;
}

/** Increments and returns the reference sequence for a key such as "VAH-F-2026". */
export function nextSequence(key: string): number {
  const data = db();
  data.counters[key] = (data.counters[key] ?? 0) + 1;
  return data.counters[key];
}
