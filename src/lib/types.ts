// Entity types for every record in the app. Shared by repositories, services and UI.
// See CLAUDE.md §5–§9 for the business meaning of each field.

export type ID = string;
/** ISO 8601 timestamp, e.g. "2026-11-05T09:30:00.000Z". */
export type ISODateTime = string;
/** Calendar date, "YYYY-MM-DD". */
export type ISODate = string;

// ---------- People ----------

export type Role = "WORKER" | "SUPERVISOR" | "ADMIN";
export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export interface User {
  id: ID;
  name: string;
  email: string;
  /** MOCK: plain-text demo password. Production uses a real auth provider and hashed passwords. */
  password: string;
  company: string;
  position: string;
  role: Role;
  status: UserStatus;
  createdAt: ISODateTime;
}

/** A user as the signed-in UI sees them: never includes the password. */
export type PublicUser = Omit<User, "password">;

// ---------- Admin-managed reference lists ----------

/** Shared shape for simple admin-editable lists (locations, packages, vessel types, risk categories). */
export interface LookupItem {
  id: ID;
  name: string;
  active: boolean;
}

export type Location = LookupItem;
export type Package = LookupItem;
export type VesselType = LookupItem;
export type RiskCategory = LookupItem;

/** Self = the crew checking their own work; Supervisory = someone else checking it (dashboard split). */
export type AssuranceLevel = "SELF" | "SUPERVISORY";

export interface AuditType {
  id: ID;
  /** Stable slug, e.g. "SELF_ASSESSMENT", "MFE". */
  code: string;
  name: string;
  assuranceLevel: AssuranceLevel;
  /** Roles allowed to pick this audit type. */
  allowedRoles: Role[];
  displayOrder: number;
  active: boolean;
}

export type VesselStatus = "ACTIVE" | "INACTIVE";

export interface Vessel {
  id: ID;
  name: string;
  vesselTypeId: ID;
  packageId: ID;
  /** Vessel operator, if known. Not used for contractor ranking (that uses the submitter's company). */
  contractor: string | null;
  defaultLocationId: ID;
  status: VesselStatus;
}

// ---------- Modules & question bank ----------

export type ModuleCategory = "START_WORK" | "ASSURANCE";

export interface Module {
  id: ID;
  name: string;
  description: string;
  category: ModuleCategory;
  displayOrder: number;
  active: boolean;
}

export interface Question {
  id: ID;
  moduleId: ID;
  text: string;
  riskCategoryId: ID;
  weight: number;
  /** A "No" answer automatically raises a High-risk finding that needs an action owner. */
  criticalControl: boolean;
  /** A photo is required when the answer is "No" or "Concern Identified". */
  evidenceRequired: boolean;
  /** Empty = applies to all vessel types. */
  vesselTypeIds: ID[];
  /** Empty = applies to all audit types. */
  auditTypeIds: ID[];
  displayOrder: number;
  /** Questions are never deleted, only deactivated. */
  active: boolean;
}

// ---------- Assessments & responses ----------

export type AssessmentKind = "MODULE" | "FULL_VESSEL" | "START_WORK";
export type AssessmentStatus = "DRAFT" | "SUBMITTED";

/** Extra details captured when a Start Work Check is set up. */
export interface StartWorkDetails {
  /** What job the team is about to start. */
  taskDescription: string;
  /** Number of people in the team doing the job. */
  teamSize: number;
}

export interface Assessment {
  id: ID;
  /** "VAH-A-YYYY-NNNN", assigned when the draft is created. Deleted drafts leave gaps in the sequence. */
  reference: string;
  kind: AssessmentKind;
  /** One module for MODULE / START_WORK; every Assurance module for FULL_VESSEL. */
  moduleIds: ID[];
  userId: ID;
  vesselId: ID;
  locationId: ID;
  auditTypeId: ID;
  /** Only for Start Work Checks (kind START_WORK); null otherwise. */
  startWork: StartWorkDetails | null;
  status: AssessmentStatus;
  /** Whole percent, or null when every answer is N/A (or not yet submitted). */
  overallScore: number | null;
  moduleScores: Record<ID, number | null>;
  /** Captured at creation so later profile or vessel changes do not rewrite history. */
  snapshot: {
    userName: string;
    company: string;
    position: string;
    vesselName: string;
    packageId: ID;
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  submittedAt: ISODateTime | null;
}

export type Answer = "YES" | "CONCERN" | "NO" | "NA";
export type ObservationTag = "GOOD_PRACTICE" | "IMPROVEMENT";

export interface Response {
  id: ID;
  assessmentId: ID;
  questionId: ID;
  moduleId: ID;
  answer: Answer;
  comment: string;
  observationTag: ObservationTag | null;
  /** Up to 5 photos (MAX_PHOTOS_PER_QUESTION), in the order they were added. */
  photoIds: ID[];
  /** Question as it was when answered, so editing the bank never changes past scores. */
  questionSnapshot: {
    text: string;
    weight: number;
    criticalControl: boolean;
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------- Findings, actions & activity ----------

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type WorkStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export interface Finding {
  id: ID;
  /** "VAH-F-YYYY-NNNN" */
  reference: string;
  assessmentId: ID;
  responseId: ID | null;
  vesselId: ID;
  moduleId: ID | null;
  description: string;
  risk: RiskLevel;
  /** Raised from a critical-control question. */
  critical: boolean;
  raisedById: ID;
  raisedAt: ISODateTime;
  status: WorkStatus;
  closureComment: string | null;
  closedById: ID | null;
  closedAt: ISODateTime | null;
}

export interface Action {
  id: ID;
  /** "<finding reference>-A<n>", e.g. "VAH-F-2026-0042-A1" */
  reference: string;
  findingId: ID;
  description: string;
  ownerId: ID;
  targetDate: ISODate;
  status: WorkStatus;
  closureComment: string | null;
  closureEvidencePhotoId: ID | null;
  createdById: ID;
  createdAt: ISODateTime;
  closedById: ID | null;
  closedAt: ISODateTime | null;
}

/**
 * A finding the user has prepared while drafting an assessment. It becomes a Finding (with action A1 for the
 * owner and target date) when the assessment is submitted, and is then deleted.
 */
export interface FindingDraft {
  id: ID;
  assessmentId: ID;
  /** The question it was raised from, or null for a general finding. */
  questionId: ID | null;
  description: string;
  risk: RiskLevel;
  /** Owner of the first action. */
  ownerId: ID;
  /** Target date of the first action. */
  targetDate: ISODate;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type FindingActivityType =
  | "RAISED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "ACTION_ADDED"
  | "ACTION_UPDATED"
  | "ACTION_CLOSED"
  | "COMMENT"
  | "CLOSED"
  | "REOPENED";

/** Append-only audit trail for a finding and its actions ("who did what, when"). */
export interface FindingActivity {
  id: ID;
  findingId: ID;
  actionId: ID | null;
  userId: ID;
  type: FindingActivityType;
  note: string;
  at: ISODateTime;
}

// ---------- Positive interventions & notifications ----------

export interface PositiveIntervention {
  id: ID;
  /** "VAH-P-YYYY-NNNN" */
  reference: string;
  assessmentId: ID;
  responseId: ID | null;
  vesselId: ID;
  moduleId: ID | null;
  description: string;
  recordedById: ID;
  recordedAt: ISODateTime;
}

export type NotificationType = "HIGH_RISK_FINDING" | "ACTION_ASSIGNED";

export interface Notification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app path to open, e.g. "/findings/<id>". */
  link: string;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}

// ---------- Photos ----------

export interface PhotoMeta {
  id: ID;
  mimeType: string;
  /** Bytes, after browser-side compression. */
  size: number;
  /** Pixel size of the stored image, when known. */
  width: number | null;
  height: number | null;
  createdAt: ISODateTime;
}
