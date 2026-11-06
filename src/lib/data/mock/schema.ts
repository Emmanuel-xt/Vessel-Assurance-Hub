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
export const STORAGE_KEY = "vah-demo-v1";

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
