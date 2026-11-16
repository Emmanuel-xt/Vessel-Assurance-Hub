// MOCK: seed reference lists. Admins can edit all of these in the app.

import type { AuditType, LookupItem } from "@/lib/types";

const item = (id: string, name: string): LookupItem => ({ id, name, active: true });

/** Vessel locations (owner's list, 2026-11-16). "Other" can be picked but no vessel starts there. */
export const LOCATIONS = [
  item("loc-bonga", "Bonga"),
  item("loc-onne", "Onne"),
  item("loc-aveon", "Aveon"),
  item("loc-marconi", "Marconi"),
  item("loc-other", "Other"),
];

/** The named locations vessels are assigned to (everything except "Other"). */
export const NAMED_LOCATION_IDS = ["loc-bonga", "loc-onne", "loc-aveon", "loc-marconi"];

export const PACKAGES = [
  item("pkg-epc1", "EPC1"),
  item("pkg-epc2", "EPC2"),
  item("pkg-wells", "Wells"),
  item("pkg-company-epc3", "Company/EPC3"),
];

export const VESSEL_TYPES = [
  item("vt-installation", "Installation Vessel"),
  item("vt-cargo-barge", "Cargo Barge"),
  item("vt-ahts", "AHTS"),
  item("vt-psv", "PSV"),
  item("vt-crew-boat", "Crew Boat"),
  item("vt-sev", "SEV"),
  item("vt-flotel", "FLOTEL"),
  item("vt-hlv", "HLV"),
];

/** Default risk categories until the owner supplies the real list (CLAUDE.md §16). */
export const RISK_CATEGORIES = [
  item("rc-personal-safety", "Personal Safety"),
  item("rc-process-safety", "Process Safety"),
  item("rc-marine-ops", "Marine Operations"),
  item("rc-security", "Security"),
  item("rc-health", "Health"),
  item("rc-environment", "Environment"),
];

const EVERYONE: AuditType["allowedRoles"] = ["WORKER", "SUPERVISOR", "AUDITOR", "VISITOR", "ADMIN"];
/** Workers' LOD 1 checks (owner decision, 2026-11-16). */
const WORKER_TYPES: AuditType["allowedRoles"] = ["WORKER", "ADMIN"];
/** Supervisors, auditors and visitors use Self Assessment and MFE only (owner decision, 2026-11-16). */
const LEADER_TYPES: AuditType["allowedRoles"] = ["SUPERVISOR", "AUDITOR", "VISITOR", "ADMIN"];

export const AUDIT_TYPES: AuditType[] = [
  { id: "at-pre-mob", code: "PRE_MOB", name: "Pre-Mob", assuranceLevel: "SELF", allowedRoles: WORKER_TYPES, displayOrder: 1, active: true },
  { id: "at-lod1", code: "LOD1", name: "LOD 1", assuranceLevel: "SELF", allowedRoles: WORKER_TYPES, displayOrder: 2, active: true },
  { id: "at-self-assessment", code: "SELF_ASSESSMENT", name: "Self Assessment", assuranceLevel: "SELF", allowedRoles: LEADER_TYPES, displayOrder: 3, active: true },
  { id: "at-mfe", code: "MFE", name: "MFE", assuranceLevel: "SUPERVISORY", allowedRoles: LEADER_TYPES, displayOrder: 4, active: true },
  { id: "at-start-work-check", code: "START_WORK_CHECK", name: "Start Work Check", assuranceLevel: "SELF", allowedRoles: EVERYONE, displayOrder: 5, active: true },
];
