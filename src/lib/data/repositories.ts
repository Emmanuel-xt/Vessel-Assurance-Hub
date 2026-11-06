// Repository contracts. Every implementation (the mock today, a real API later) must satisfy these.
// All functions are async and return copies: mutating a returned object never changes stored data.

import type {
  Action,
  Assessment,
  AssessmentKind,
  AssessmentStatus,
  AuditType,
  Finding,
  FindingActivity,
  FindingDraft,
  ID,
  ISODateTime,
  LookupItem,
  Module,
  ModuleCategory,
  Notification,
  PhotoMeta,
  PositiveIntervention,
  PublicUser,
  Question,
  Response,
  RiskLevel,
  Role,
  User,
  UserStatus,
  Vessel,
  VesselStatus,
  WorkStatus,
} from "@/lib/types";

// ---------- Errors ----------

export type RepositoryErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  // Sign-in outcomes
  | "INVALID_CREDENTIALS"
  | "PENDING_APPROVAL"
  | "ACCOUNT_DISABLED";

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

// ---------- Shared shape ----------

export interface CrudRepository<T, CreateInput, Filter = undefined, Patch = Partial<CreateInput>> {
  list(filter?: Filter): Promise<T[]>;
  /** Resolves to null when the record does not exist. */
  get(id: ID): Promise<T | null>;
  create(input: CreateInput): Promise<T>;
  /** Rejects with RepositoryError("NOT_FOUND") when the record does not exist. */
  update(id: ID, patch: Patch): Promise<T>;
}

export interface ActiveFilter {
  activeOnly?: boolean;
}

// ---------- Users ----------

export interface UserFilter {
  status?: UserStatus;
  role?: Role;
  /** Case-insensitive match on name, email or company. */
  search?: string;
}

export type UserCreateInput = Omit<User, "id" | "createdAt" | "status"> & { status?: UserStatus };

export interface UsersRepository extends CrudRepository<User, UserCreateInput, UserFilter> {
  /** Case-insensitive. */
  findByEmail(email: string): Promise<User | null>;
}

// ---------- Reference lists ----------

export type LookupCreateInput = Omit<LookupItem, "id" | "active"> & { active?: boolean };
export type LookupRepository = CrudRepository<LookupItem, LookupCreateInput, ActiveFilter>;

export type AuditTypeCreateInput = Omit<AuditType, "id" | "active"> & { active?: boolean };

export interface AuditTypesRepository extends CrudRepository<AuditType, AuditTypeCreateInput, ActiveFilter> {
  /** Active audit types the given role may pick, in display order. */
  listForRole(role: Role): Promise<AuditType[]>;
}

// ---------- Vessels ----------

export interface VesselFilter {
  status?: VesselStatus;
  packageId?: ID;
  vesselTypeId?: ID;
  locationId?: ID;
}

export type VesselCreateInput = Omit<Vessel, "id" | "status"> & { status?: VesselStatus };
export type VesselsRepository = CrudRepository<Vessel, VesselCreateInput, VesselFilter>;

// ---------- Modules & questions ----------

export interface ModuleFilter extends ActiveFilter {
  category?: ModuleCategory;
}

export type ModuleCreateInput = Omit<Module, "id" | "active"> & { active?: boolean };
export type ModulesRepository = CrudRepository<Module, ModuleCreateInput, ModuleFilter>;

export interface QuestionFilter extends ActiveFilter {
  moduleId?: ID;
}

export interface QuestionApplicability {
  moduleId: ID;
  vesselTypeId: ID;
  auditTypeId: ID;
}

export type QuestionCreateInput = Omit<Question, "id" | "active"> & { active?: boolean };

export interface QuestionsRepository extends CrudRepository<Question, QuestionCreateInput, QuestionFilter> {
  /** Active questions for one module that apply to the vessel type and audit type, in display order. */
  listFor(applicability: QuestionApplicability): Promise<Question[]>;
  /** Creates all questions or none (rejects without saving anything if any input is invalid). */
  createMany(inputs: QuestionCreateInput[]): Promise<Question[]>;
  /** Whether any response (draft or submitted) uses this question. */
  isAnswered(id: ID): Promise<boolean>;
  /** Ids of every question that has at least one response. */
  listAnsweredIds(): Promise<ID[]>;
  /**
   * Permanently deletes a question that has never been answered.
   * Rejects with CONFLICT if it has been answered (deactivate it instead).
   */
  remove(id: ID): Promise<void>;
}

// ---------- Assessments & responses ----------

export interface AssessmentFilter {
  userId?: ID;
  status?: AssessmentStatus;
  vesselId?: ID;
}

export interface SubmittedAssessmentFilter {
  vesselIds?: ID[];
  locationIds?: ID[];
  packageIds?: ID[];
  /** Matches assessments that include this module. */
  moduleId?: ID;
  auditTypeIds?: ID[];
  kinds?: AssessmentKind[];
  /** Submitter's company (contractor ranking). */
  companies?: string[];
  userId?: ID;
  /** Inclusive range on submittedAt. */
  from?: ISODateTime;
  to?: ISODateTime;
}

export type AssessmentCreateInput = Pick<
  Assessment,
  "kind" | "moduleIds" | "userId" | "vesselId" | "locationId" | "auditTypeId"
> & {
  /** Start Work Checks only; defaults to null. */
  startWork?: Assessment["startWork"];
};

export type AssessmentScoresInput = Pick<Assessment, "overallScore" | "moduleScores">;

export type AssessmentPatch = Partial<Pick<Assessment, "locationId" | "auditTypeId" | "moduleIds">>;

export interface AssessmentsRepository
  extends CrudRepository<Assessment, AssessmentCreateInput, AssessmentFilter, AssessmentPatch> {
  /** Submitted assessments only, newest first. */
  listSubmitted(filter?: SubmittedAssessmentFilter): Promise<Assessment[]>;
  /**
   * Marks a draft SUBMITTED with the scores calculated by the service layer (src/lib/services/scoring.ts).
   * Rejects with CONFLICT if already submitted.
   */
  submit(id: ID, scores: AssessmentScoresInput): Promise<Assessment>;
  /** Deletes a draft and its responses. Rejects with CONFLICT for submitted assessments. */
  removeDraft(id: ID): Promise<void>;
}

export type ResponseCreateInput = Pick<
  Response,
  "assessmentId" | "questionId" | "answer" | "comment" | "observationTag" | "photoIds"
>;

export type ResponsePatch = Partial<Pick<Response, "answer" | "comment" | "observationTag" | "photoIds">>;

export interface ResponsesRepository
  extends CrudRepository<Response, ResponseCreateInput, { assessmentId?: ID }, ResponsePatch> {
  listByAssessment(assessmentId: ID): Promise<Response[]>;
  /** Creates or replaces the answer to one question in a draft. */
  upsert(input: ResponseCreateInput): Promise<Response>;
  remove(id: ID): Promise<void>;
}

// ---------- Findings, actions & activity ----------

export interface FindingFilter {
  status?: WorkStatus;
  assessmentId?: ID;
  vesselId?: ID;
  risk?: RiskLevel;
  raisedById?: ID;
}

export type FindingCreateInput = Pick<
  Finding,
  "assessmentId" | "responseId" | "description" | "risk" | "critical" | "raisedById"
>;

export type FindingPatch = Partial<
  Pick<Finding, "description" | "risk" | "status" | "closureComment" | "closedById" | "closedAt">
>;

export type FindingsRepository = CrudRepository<Finding, FindingCreateInput, FindingFilter, FindingPatch>;

export type FindingDraftCreateInput = Pick<
  FindingDraft,
  "assessmentId" | "questionId" | "description" | "risk" | "ownerId" | "targetDate"
>;

export type FindingDraftPatch = Partial<Pick<FindingDraft, "description" | "risk" | "ownerId" | "targetDate">>;

/** Findings being prepared on a DRAFT assessment (server-side drafts in production). */
export interface FindingDraftsRepository {
  /** Oldest first. */
  listByAssessment(assessmentId: ID): Promise<FindingDraft[]>;
  get(id: ID): Promise<FindingDraft | null>;
  /** Rejects with CONFLICT unless the assessment is a DRAFT. */
  create(input: FindingDraftCreateInput): Promise<FindingDraft>;
  update(id: ID, patch: FindingDraftPatch): Promise<FindingDraft>;
  remove(id: ID): Promise<void>;
}

export interface ActionFilter {
  findingId?: ID;
  ownerId?: ID;
  status?: WorkStatus;
}

export type ActionCreateInput = Pick<Action, "findingId" | "description" | "ownerId" | "targetDate" | "createdById">;

export type ActionPatch = Partial<
  Pick<
    Action,
    | "description"
    | "ownerId"
    | "targetDate"
    | "status"
    | "closureComment"
    | "closureEvidencePhotoId"
    | "closedById"
    | "closedAt"
  >
>;

export type ActionsRepository = CrudRepository<Action, ActionCreateInput, ActionFilter, ActionPatch>;

export type FindingActivityCreateInput = Omit<FindingActivity, "id" | "at">;

/** Append-only: there is no update. */
export interface FindingActivitiesRepository {
  listByFinding(findingId: ID): Promise<FindingActivity[]>;
  create(input: FindingActivityCreateInput): Promise<FindingActivity>;
}

// ---------- Positive interventions & notifications ----------

export interface PositiveInterventionFilter {
  assessmentId?: ID;
  vesselId?: ID;
  from?: ISODateTime;
  to?: ISODateTime;
}

export type PositiveInterventionCreateInput = Pick<
  PositiveIntervention,
  "assessmentId" | "responseId" | "description" | "recordedById"
>;

export type PositiveInterventionsRepository = CrudRepository<
  PositiveIntervention,
  PositiveInterventionCreateInput,
  PositiveInterventionFilter,
  Partial<Pick<PositiveIntervention, "description">>
>;

export type NotificationCreateInput = Pick<Notification, "userId" | "type" | "title" | "body" | "link">;

export interface NotificationsRepository {
  /** Newest first. */
  listForUser(userId: ID, options?: { unreadOnly?: boolean }): Promise<Notification[]>;
  create(input: NotificationCreateInput): Promise<Notification>;
  markRead(id: ID): Promise<Notification>;
  markAllRead(userId: ID): Promise<void>;
}

// ---------- Photos ----------

export interface PhotoDimensions {
  width: number;
  height: number;
}

/**
 * Photo storage. The mock keeps images in the browser's IndexedDB; production swaps in cloud object storage
 * (upload to a bucket, getUrl returns a signed URL) without the UI changing.
 */
export interface PhotosRepository {
  /** Stores an (already compressed) image and returns its metadata. */
  upload(blob: Blob, dimensions?: PhotoDimensions): Promise<PhotoMeta>;
  /** A URL an <img> can display. Resolves to null when the photo does not exist. */
  getUrl(id: ID): Promise<string | null>;
  /** Resolves to null when the photo does not exist. */
  getMeta(id: ID): Promise<PhotoMeta | null>;
  /** Deleting a photo that does not exist is not an error. */
  delete(id: ID): Promise<void>;
}

// ---------- Authentication ----------

export type SignUpInput = Pick<User, "name" | "email" | "password" | "company" | "position"> & {
  /** Self-signup can only request these roles; admins grant ADMIN. */
  requestedRole: Extract<Role, "WORKER" | "SUPERVISOR">;
};

export interface AuthRepository {
  /** Creates a PENDING account. Rejects with CONFLICT if the email is taken. */
  signUp(input: SignUpInput): Promise<PublicUser>;
  /**
   * Starts a session for an ACTIVE user. Rejects with INVALID_CREDENTIALS (unknown email or wrong password),
   * PENDING_APPROVAL or ACCOUNT_DISABLED.
   */
  logIn(email: string, password: string): Promise<PublicUser>;
  /** The signed-in user, or null. Ends the session if the user is no longer ACTIVE. */
  getSessionUser(): Promise<PublicUser | null>;
  logOut(): Promise<void>;
}

// ---------- Demo controls ----------

/** MOCK: demo-only controls. A production implementation does not provide these. */
export interface DemoRepository {
  /** Restores the fixtures and deletes every stored photo. */
  reset(): Promise<void>;
  /** Signs in as an ACTIVE user without a password (demo quick-login and "Demo as"). */
  logInAs(userId: ID): Promise<PublicUser>;
}

// ---------- Everything ----------

export interface Repositories {
  auth: AuthRepository;
  users: UsersRepository;
  locations: LookupRepository;
  packages: LookupRepository;
  vesselTypes: LookupRepository;
  riskCategories: LookupRepository;
  auditTypes: AuditTypesRepository;
  vessels: VesselsRepository;
  modules: ModulesRepository;
  questions: QuestionsRepository;
  assessments: AssessmentsRepository;
  responses: ResponsesRepository;
  findings: FindingsRepository;
  actions: ActionsRepository;
  findingActivities: FindingActivitiesRepository;
  findingDrafts: FindingDraftsRepository;
  positiveInterventions: PositiveInterventionsRepository;
  notifications: NotificationsRepository;
  photos: PhotosRepository;
  demo: DemoRepository;
}
