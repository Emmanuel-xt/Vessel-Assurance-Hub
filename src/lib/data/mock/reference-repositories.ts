// MOCK: users, reference lists, vessels, modules and the question bank.

import {
  RepositoryError,
  type ActiveFilter,
  type AuditTypeCreateInput,
  type AuditTypesRepository,
  type LookupCreateInput,
  type LookupRepository,
  type ModuleCreateInput,
  type ModuleFilter,
  type ModulesRepository,
  type QuestionCreateInput,
  type QuestionFilter,
  type QuestionsRepository,
  type UserCreateInput,
  type UserFilter,
  type UsersRepository,
  type VesselCreateInput,
  type VesselFilter,
  type VesselsRepository,
} from "@/lib/data/repositories";
import { activeOnly, byDisplayOrder, crud, requireRow, rows } from "./crud";
import type { TableName } from "./schema";
import { db, persist } from "./store";
import { clone, newId, nowIso, simulateLatency } from "./utils";

// ---------- Users ----------

const normaliseEmail = (email: string) => email.trim().toLowerCase();

function assertEmailFree(email: string, exceptId?: string) {
  const taken = rows("users").some((u) => u.id !== exceptId && normaliseEmail(u.email) === normaliseEmail(email));
  if (taken) throw new RepositoryError("CONFLICT", `An account with ${email} already exists`);
}

const usersCrud = crud<"users", UserCreateInput, UserFilter>("users", {
  entity: "User",
  build: (input) => {
    assertEmailFree(input.email);
    return { ...input, email: input.email.trim(), id: newId(), status: input.status ?? "PENDING", createdAt: nowIso() };
  },
  matches: (u, f) => {
    if (f.status && u.status !== f.status) return false;
    if (f.role && u.role !== f.role) return false;
    if (f.search) {
      const term = f.search.trim().toLowerCase();
      return [u.name, u.email, u.company].some((field) => field.toLowerCase().includes(term));
    }
    return true;
  },
  compare: (a, b) => a.name.localeCompare(b.name),
  beforeUpdate: (row, patch) => {
    if (patch.email !== undefined) assertEmailFree(patch.email, row.id);
  },
});

export const users: UsersRepository = {
  ...usersCrud,
  async findByEmail(email) {
    await simulateLatency();
    const user = rows("users").find((u) => normaliseEmail(u.email) === normaliseEmail(email));
    return user ? clone(user) : null;
  },
};

// ---------- Simple reference lists ----------

type LookupTable = Extract<TableName, "locations" | "packages" | "vesselTypes" | "riskCategories">;

function lookup(table: LookupTable, entity: string): LookupRepository {
  return crud<LookupTable, LookupCreateInput, ActiveFilter>(table, {
    entity,
    build: (input) => ({ id: newId(), name: input.name.trim(), active: input.active ?? true }),
    matches: activeOnly,
  });
}

export const locations = lookup("locations", "Location");
export const packages = lookup("packages", "Package");
export const vesselTypes = lookup("vesselTypes", "Vessel type");
export const riskCategories = lookup("riskCategories", "Risk category");

// ---------- Audit types ----------

const auditTypesCrud = crud<"auditTypes", AuditTypeCreateInput, ActiveFilter>("auditTypes", {
  entity: "Audit type",
  build: (input) => ({ ...input, id: newId(), active: input.active ?? true }),
  matches: activeOnly,
  compare: byDisplayOrder,
});

export const auditTypes: AuditTypesRepository = {
  ...auditTypesCrud,
  async listForRole(role) {
    const active = await auditTypesCrud.list({ activeOnly: true });
    return active.filter((t) => t.allowedRoles.includes(role));
  },
};

// ---------- Vessels ----------

export const vessels: VesselsRepository = crud<"vessels", VesselCreateInput, VesselFilter>("vessels", {
  entity: "Vessel",
  build: (input) => ({ ...input, id: newId(), status: input.status ?? "ACTIVE" }),
  matches: (v, f) =>
    (!f.status || v.status === f.status) &&
    (!f.packageId || v.packageId === f.packageId) &&
    (!f.vesselTypeId || v.vesselTypeId === f.vesselTypeId) &&
    (!f.locationId || v.defaultLocationId === f.locationId),
  compare: (a, b) => a.name.localeCompare(b.name),
});

// ---------- Modules ----------

export const modules: ModulesRepository = crud<"modules", ModuleCreateInput, ModuleFilter>("modules", {
  entity: "Module",
  build: (input) => ({ ...input, id: newId(), active: input.active ?? true }),
  matches: (m, f) => activeOnly(m, f) && (!f.category || m.category === f.category),
  compare: byDisplayOrder,
});

// ---------- Questions ----------

function buildQuestion(input: QuestionCreateInput) {
  requireRow("modules", input.moduleId, "Module");
  requireRow("riskCategories", input.riskCategoryId, "Risk category");
  return { ...input, id: newId(), active: input.active ?? true };
}

const isAnswered = (questionId: string) => rows("responses").some((r) => r.questionId === questionId);

const questionsCrud = crud<"questions", QuestionCreateInput, QuestionFilter>("questions", {
  entity: "Question",
  build: buildQuestion,
  matches: (q, f) => activeOnly(q, f) && (!f.moduleId || q.moduleId === f.moduleId),
  compare: (a, b) => a.moduleId.localeCompare(b.moduleId) || byDisplayOrder(a, b),
});

export const questions: QuestionsRepository = {
  ...questionsCrud,
  async listFor({ moduleId, vesselTypeId, auditTypeId }) {
    const inModule = await questionsCrud.list({ moduleId, activeOnly: true });
    return inModule.filter(
      (q) =>
        (q.vesselTypeIds.length === 0 || q.vesselTypeIds.includes(vesselTypeId)) &&
        (q.auditTypeIds.length === 0 || q.auditTypeIds.includes(auditTypeId)),
    );
  },

  async createMany(inputs) {
    await simulateLatency();
    const built = inputs.map(buildQuestion); // throws before anything is saved
    rows("questions").push(...built);
    persist();
    return clone(built);
  },

  async isAnswered(id) {
    await simulateLatency();
    return isAnswered(id);
  },

  async listAnsweredIds() {
    await simulateLatency();
    return [...new Set(rows("responses").map((r) => r.questionId))];
  },

  async remove(id) {
    await simulateLatency();
    requireRow("questions", id, "Question");
    if (isAnswered(id)) {
      throw new RepositoryError("CONFLICT", "This question has been answered, so it can only be deactivated.");
    }
    const data = db();
    data.questions = data.questions.filter((q) => q.id !== id);
    persist();
  },
};
