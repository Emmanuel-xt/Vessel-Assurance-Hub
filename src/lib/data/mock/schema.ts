// MOCK: shape of the whole demo database as held in memory and saved to localStorage.

import type {
  Action,
  Assessment,
  AuditType,
  Finding,
  FindingActivity,
  FindingDraft,
  LookupItem,
  Module,
  Notification,
  PositiveIntervention,
  Question,
  Response,
  User,
  Vessel,
} from "@/lib/types";

/** Bump the version suffix whenever DemoData changes shape: old saved data is then discarded and reseeded. */
export const STORAGE_KEY = "vah-demo-v2"; // v2: the presentation data set (2026-11-06)

/** Keys used by earlier versions; removed on first load so old copies do not fill up browser storage. */
export const LEGACY_STORAGE_KEYS = ["vah-demo-v1", "vah-demo-v1-session"];

export interface DemoData {
  users: User[];
  locations: LookupItem[];
  packages: LookupItem[];
  vesselTypes: LookupItem[];
  riskCategories: LookupItem[];
  auditTypes: AuditType[];
  vessels: Vessel[];
  modules: Module[];
  questions: Question[];
  assessments: Assessment[];
  responses: Response[];
  findings: Finding[];
  actions: Action[];
  findingActivities: FindingActivity[];
  findingDrafts: FindingDraft[];
  positiveInterventions: PositiveIntervention[];
  notifications: Notification[];
  /** Last used reference sequence per key, e.g. { "VAH-F-2026": 42 }. */
  counters: Record<string, number>;
}

export type TableName = Exclude<keyof DemoData, "counters">;
