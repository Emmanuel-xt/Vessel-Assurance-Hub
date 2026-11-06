// MOCK: builds a fresh copy of the demo database. Used on first load and by "Reset demo data".

import type { DemoData } from "@/lib/data/mock/schema";
import { AUDIT_TYPES, LOCATIONS, PACKAGES, RISK_CATEGORIES, VESSEL_TYPES } from "./lookups";
import { MODULES } from "./modules";
import { QUESTIONS } from "./questions";
import { generateHistory } from "./history";
import { USERS } from "./users";
import { VESSELS } from "./vessels";

export interface FixtureOptions {
  /** Include ~6 months of generated history (default true). Tests switch it off for a clean slate. */
  history?: boolean;
  /** "Today" for the generated history. */
  today?: Date;
}

export function buildFixtures(options: FixtureOptions = {}): DemoData {
  const history = options.history === false ? null : generateHistory({ today: options.today });
  return structuredClone({
    users: USERS,
    locations: LOCATIONS,
    packages: PACKAGES,
    vesselTypes: VESSEL_TYPES,
    riskCategories: RISK_CATEGORIES,
    auditTypes: AUDIT_TYPES,
    vessels: VESSELS,
    modules: MODULES,
    questions: QUESTIONS,
    assessments: history?.assessments ?? [],
    responses: history?.responses ?? [],
    findings: history?.findings ?? [],
    actions: history?.actions ?? [],
    findingActivities: history?.findingActivities ?? [],
    findingDrafts: [],
    positiveInterventions: history?.positiveInterventions ?? [],
    notifications: [],
    counters: history?.counters ?? {},
  });
}
