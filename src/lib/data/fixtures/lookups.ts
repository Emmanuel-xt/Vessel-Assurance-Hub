// MOCK: seed reference lists. Admins can edit all of these in the app.

import type { AuditType, LookupItem } from "@/lib/types";

const item = (id: string, name: string): LookupItem => ({ id, name, active: true });

/** Vessel locations are demo values; the register does not give real ones (CLAUDE.md §15). */
export const LOCATIONS = [
  item("loc-bonga", "Bonga"),
  item("loc-ea", "EA"),
  item("loc-forcados", "Forcados"),
  item("loc-bonny", "Bonny"),
];

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

const ALL_ROLES: AuditType["allowedRoles"] = ["WORKER", "SUPERVISOR", "ADMIN"];
const SUPERVISORY: AuditType["allowedRoles"] = ["SUPERVISOR", "ADMIN"];

export const AUDIT_TYPES: AuditType[] = [
  { id: "at-self-assessment", code: "SELF_ASSESSMENT", name: "Self Assessment", assuranceLevel: "SELF", allowedRoles: ALL_ROLES, displayOrder: 1, active: true },
  { id: "at-start-work-check", code: "START_WORK_CHECK", name: "Start Work Check", assuranceLevel: "SELF", allowedRoles: ALL_ROLES, displayOrder: 2, active: true },
  { id: "at-mfe", code: "MFE", name: "MFE", assuranceLevel: "SUPERVISORY", allowedRoles: SUPERVISORY, displayOrder: 3, active: true },
  { id: "at-spot-check", code: "SPOT_CHECK", name: "Spot Check", assuranceLevel: "SUPERVISORY", allowedRoles: SUPERVISORY, displayOrder: 4, active: true },
  { id: "at-verification", code: "VERIFICATION", name: "Verification", assuranceLevel: "SUPERVISORY", allowedRoles: SUPERVISORY, displayOrder: 5, active: true },
];
