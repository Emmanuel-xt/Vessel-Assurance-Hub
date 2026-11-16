// MOCK: the modules from the design document (CLAUDE.md §6). Bunkering and Personnel Transfer were removed
// (owner decision, 2026-11-16): 15 modules, 5 Start Work and 10 Assurance.

import type { Module, ModuleCategory, Role } from "@/lib/types";

const MODULE_LIST: [id: string, name: string, category: ModuleCategory, description: string][] = [
  ["mod-marine-start-work", "Marine Start Work", "START_WORK", "Pre-task check: competence, permits, equipment, hazards and SIMOPS before work begins."],
  ["mod-bridge-team", "Bridge Team", "ASSURANCE", "Bridge manning, equipment, communications and certification."],
  ["mod-navigation-watch", "Navigation Watch", "ASSURANCE", "Navigation systems, passage planning, weather and watchkeeping."],
  ["mod-cargo-operations", "Cargo Operations", "ASSURANCE", "Lifting, deck cargo and safe working on deck."],
  ["mod-security", "Security", "ASSURANCE", "Access control, visitors, threat awareness and restricted areas."],
  ["mod-occupational-health", "Occupational Health", "ASSURANCE", "Water quality, medical provision, fatigue and exposure."],
  ["mod-galley", "Galley", "ASSURANCE", "Hygiene, food storage and galley fire safety."],
  ["mod-working-at-height", "Working at Height", "START_WORK", "Permits, rescue plans, fall protection and dropped objects."],
  ["mod-confined-space-entry", "Confined Space Entry", "START_WORK", "Gas testing, standby person, rescue and entry permits."],
  ["mod-hot-work", "Hot Work", "START_WORK", "Gas testing, fire watch and hot work permits."],
  ["mod-energy-isolation", "Energy Isolation", "START_WORK", "Isolation, lock-out and proving zero energy."],
  ["mod-emergency-preparedness", "Emergency Preparedness", "ASSURANCE", "Lifesaving and firefighting equipment, drills and muster."],
  ["mod-leadership-engagement", "Leadership Engagement", "ASSURANCE", "Visible leadership, Stop Work Authority and speaking up."],
  ["mod-contractor-management", "Contractor Management", "ASSURANCE", "Induction, competence and supervision of contractors."],
  ["mod-learning-action-closure", "Learning & Action Closure", "ASSURANCE", "Sharing lessons and closing actions with evidence."],
];

/** Leadership modules: Supervisors see only these on the LOD 1 list; Workers do not see them (owner, 2026-11-16). */
export const LEADERSHIP_MODULE_IDS = [
  "mod-leadership-engagement",
  "mod-contractor-management",
  "mod-learning-action-closure",
];

const LEADERSHIP_ROLES: Role[] = ["SUPERVISOR", "AUDITOR", "VISITOR"];
const CREW_ROLES: Role[] = ["WORKER", "AUDITOR", "VISITOR"];

/** Who sees an Assurance module on the LOD 1 list (admins always see all). Start Work modules: everyone. */
const rolesFor = (id: string, category: ModuleCategory): Role[] =>
  category === "START_WORK" ? [] : LEADERSHIP_MODULE_IDS.includes(id) ? [...LEADERSHIP_ROLES] : [...CREW_ROLES];

export const MODULES: Module[] = MODULE_LIST.map(([id, name, category, description], index) => ({
  id,
  name,
  description,
  category,
  roles: rolesFor(id, category),
  displayOrder: index + 1,
  active: true,
}));
