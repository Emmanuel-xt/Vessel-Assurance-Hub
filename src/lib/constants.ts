// Display labels and option lists shared across the UI.

import type { Role } from "@/lib/types";

export const ROLE_LABELS: Record<Role, string> = {
  WORKER: "Worker",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
};

/** Positions offered at signup: the design document's personas. "Other" lets people type their own. */
export const POSITIONS = [
  "Crew Member",
  "Bridge Officer",
  "Master",
  "Chief Engineer",
  "Galley Team",
  "Marine Representative",
  "Offshore Coordinator",
  "Team Lead",
  "Manager/MFE Visitor",
] as const;

export const OTHER_POSITION = "Other";
