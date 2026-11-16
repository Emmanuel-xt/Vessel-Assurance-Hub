// MOCK: 27 modules. 10 Assurance modules from the design document (CLAUDE.md §6) and the owner's 17 Start Work Check
// tasks (docs/Start Work Checks/, 2026-11-16; questions in start-work-checks.ts).

import type { Module, ModuleCategory, Role } from "@/lib/types";

const MODULE_LIST: [id: string, name: string, category: ModuleCategory, description: string][] = [
  // ---------- Assurance (the LOD 1 Self Assessment list) ----------
  ["mod-bridge-team", "Bridge Team", "ASSURANCE", "Bridge manning, equipment, communications and certification."],
  ["mod-navigation-watch", "Navigation Watch", "ASSURANCE", "Navigation systems, passage planning, weather and watchkeeping."],
  ["mod-cargo-operations", "Cargo Operations", "ASSURANCE", "Lifting, deck cargo and safe working on deck."],
  ["mod-security", "Security", "ASSURANCE", "Access control, visitors, threat awareness and restricted areas."],
  ["mod-occupational-health", "Occupational Health", "ASSURANCE", "Water quality, medical provision, fatigue and exposure."],
  ["mod-galley", "Galley", "ASSURANCE", "Hygiene, food storage and galley fire safety."],
  ["mod-emergency-preparedness", "Emergency Preparedness", "ASSURANCE", "Lifesaving and firefighting equipment, drills and muster."],
  ["mod-leadership-engagement", "Leadership Engagement", "ASSURANCE", "Visible leadership, Stop Work Authority and speaking up."],
  ["mod-contractor-management", "Contractor Management", "ASSURANCE", "Induction, competence and supervision of contractors."],
  ["mod-learning-action-closure", "Learning & Action Closure", "ASSURANCE", "Sharing lessons and closing actions with evidence."],
  // ---------- Start Work Check tasks (the owner's sheets, 2026-11-16) ----------
  ["mod-deck-work", "Deck Work", "START_WORK", "Marine Start Work Check for deck work: fitness, permit, hazards, PPE, lifting, weather."],
  ["mod-bunkering", "Bunkering", "START_WORK", "Marine Start Work Check before a fuel or liquid transfer: hoses, shutdown, spill controls."],
  ["mod-personnel-transfer", "Offshore Personnel Transfer", "START_WORK", "Before transferring people by basket, gangway or crew boat."],
  ["mod-mechanical-lifting", "Mechanical Lifting", "START_WORK", "IOGP Start Work Check: lift plan, rated rigging, communications, exclusion zones."],
  ["mod-working-at-height", "Working at Height", "START_WORK", "IOGP Start Work Check: fall protection, 100% tie-off, dropped objects, rescue plan."],
  ["mod-hot-work", "Hot Work", "START_WORK", "IOGP Start Work Check: gas test, ignition sources, flammables, fire watch."],
  ["mod-energy-isolation", "Energy Isolation", "START_WORK", "IOGP Start Work Check: isolation plan, locks and tags, proven zero energy."],
  ["mod-de-isolation", "De-Isolation & Re-Energising", "START_WORK", "IOGP Start Work Check before returning a system to service."],
  ["mod-confined-space-entry", "Confined Space Entry", "START_WORK", "IOGP Start Work Check: gas testing, ventilation, attendant, rescue plan."],
  ["mod-energised-electrical", "Energised / Live Electrical Work", "START_WORK", "IOGP Start Work Check: rated PPE, restricted zones, standby person, insulated tools."],
  ["mod-man-riding", "Man-riding", "START_WORK", "IOGP Start Work Check: qualified crew, certified equipment, secured tools, rescue plan."],
  ["mod-work-near-water", "Work Near Water", "START_WORK", "IOGP Start Work Check: exclusion zones, PFDs, walking surfaces, rescue plan."],
  ["mod-mobile-equipment", "Working Around Mobile Equipment", "START_WORK", "IOGP Start Work Check: travel paths, pedestrian separation, inspection, no unintended movement."],
  ["mod-excavation", "Excavation", "START_WORK", "IOGP Start Work Check: utilities, soil stability, barriers, safe entry."],
  ["mod-decommissioning", "Decommissioning & Demolition", "START_WORK", "IOGP Start Work Check: hazardous materials, isolation, stored energy, dropped objects."],
  ["mod-rig-floor-tubular", "Rig Floor Tubular Handling", "START_WORK", "IOGP Start Work Check: rated hoisting gear, elevator inserts, latching, restricted zones."],
  ["mod-driving", "Driving", "START_WORK", "IOGP Start Work Check: journey plan, fit driver, vehicle inspection, seatbelts, no distractions."],
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
