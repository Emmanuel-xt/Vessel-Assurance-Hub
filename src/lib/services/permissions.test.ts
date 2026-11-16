import { describe, expect, it } from "vitest";
import { AUDIT_TYPES } from "@/lib/data/fixtures/lookups";
import { MODULES } from "@/lib/data/fixtures/modules";
import {
  canAccessAdmin,
  canChangeUserRole,
  canChangeUserStatus,
  canStartFullVessel,
  canUseAuditType,
  canViewDashboard,
  isModuleVisibleTo,
  modulesVisibleTo,
  requireRole,
  requireUser,
  signInBlock,
} from "@/lib/services/permissions";
import type { Role, User } from "@/lib/types";

const person = (role: Role, status: User["status"] = "ACTIVE") => ({ id: `u-${role}`, role, status });
const allowedCodes = (role: Role) => AUDIT_TYPES.filter((t) => canUseAuditType(role, t)).map((t) => t.code);

describe("requireUser", () => {
  it("returns an active user", () => {
    const worker = person("WORKER");
    expect(requireUser(worker)).toBe(worker);
  });

  it.each([null, undefined, person("WORKER", "PENDING"), person("ADMIN", "DISABLED")])(
    "rejects %o as UNAUTHENTICATED",
    (user) => {
      expect(() => requireUser(user)).toThrow(expect.objectContaining({ code: "UNAUTHENTICATED" }));
    },
  );
});

describe("requireRole", () => {
  it("allows a listed role", () => {
    expect(requireRole(person("ADMIN"), "ADMIN").role).toBe("ADMIN");
    expect(requireRole(person("SUPERVISOR"), "SUPERVISOR", "ADMIN").role).toBe("SUPERVISOR");
  });

  it("rejects other roles as FORBIDDEN and no user as UNAUTHENTICATED", () => {
    expect(() => requireRole(person("WORKER"), "ADMIN")).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => requireRole(null, "ADMIN")).toThrow(expect.objectContaining({ code: "UNAUTHENTICATED" }));
  });
});

describe("canUseAuditType with the seeded audit types", () => {
  it("limits workers to Pre-Mob, LOD 1 and Start Work Check", () => {
    expect(allowedCodes("WORKER")).toEqual(["PRE_MOB", "LOD1", "START_WORK_CHECK"]);
  });

  it("gives supervisors, auditors and visitors Self Assessment, MFE and Start Work Check", () => {
    for (const role of ["SUPERVISOR", "AUDITOR", "VISITOR"] as const) {
      expect(allowedCodes(role)).toEqual(["SELF_ASSESSMENT", "MFE", "START_WORK_CHECK"]);
    }
  });

  it("gives admins every audit type", () => {
    expect(allowedCodes("ADMIN")).toEqual(AUDIT_TYPES.map((t) => t.code));
  });

  it("follows admin edits and never allows an inactive audit type", () => {
    expect(canUseAuditType("WORKER", { allowedRoles: ["WORKER", "SUPERVISOR"], active: true })).toBe(true);
    expect(canUseAuditType("ADMIN", { allowedRoles: ["ADMIN"], active: false })).toBe(false);
  });
});

describe("LOD 1 modules and Full Vessel Assurance", () => {
  const visible = (role: Parameters<typeof modulesVisibleTo>[0]) =>
    modulesVisibleTo(role, MODULES.filter((m) => m.category === "ASSURANCE")).map((m) => m.id);
  const LEADERSHIP = ["mod-leadership-engagement", "mod-contractor-management", "mod-learning-action-closure"];

  it("shows workers the crew modules, supervisors only the 3 leadership modules", () => {
    expect(visible("WORKER")).toHaveLength(7);
    expect(visible("WORKER")).not.toEqual(expect.arrayContaining([LEADERSHIP[0]]));
    expect(visible("SUPERVISOR")).toEqual(LEADERSHIP);
  });

  it("shows auditors, visitors and admins every module", () => {
    for (const role of ["AUDITOR", "VISITOR", "ADMIN"] as const) expect(visible(role)).toHaveLength(10);
    expect(isModuleVisibleTo("ADMIN", { roles: ["WORKER"] })).toBe(true);
    expect(isModuleVisibleTo("WORKER", { roles: [] })).toBe(true);
  });

  it("opens Full Vessel Assurance to auditors and admins only", () => {
    expect(
      (["WORKER", "SUPERVISOR", "AUDITOR", "VISITOR", "ADMIN"] as const).map((role) => canStartFullVessel(person(role))),
    ).toEqual([false, false, true, false, true]);
  });
});

describe("area access", () => {
  it("opens admin to admins only and the dashboard to supervisors, auditors and admins", () => {
    expect([canAccessAdmin(person("ADMIN")), canAccessAdmin(person("SUPERVISOR"))]).toEqual([true, false]);
    expect(
      (["WORKER", "SUPERVISOR", "AUDITOR", "VISITOR", "ADMIN"] as const).map((role) => canViewDashboard(person(role))),
    ).toEqual([false, true, true, false, true]);
    expect(canAccessAdmin(person("ADMIN", "DISABLED"))).toBe(false);
  });

  it("explains why an account cannot sign in", () => {
    expect(signInBlock("PENDING")).toBe("PENDING_APPROVAL");
    expect(signInBlock("DISABLED")).toBe("ACCOUNT_DISABLED");
    expect(signInBlock("ACTIVE")).toBeNull();
  });
});

describe("user management rules", () => {
  const admin = { id: "a1", role: "ADMIN" as const, status: "ACTIVE" as const };
  const otherAdmin = { id: "a2", role: "ADMIN" as const, status: "ACTIVE" as const };
  const worker = { id: "w1", role: "WORKER" as const, status: "ACTIVE" as const };

  it("blocks self-disable and self role change", () => {
    expect(canChangeUserStatus(admin, admin, "DISABLED", 2)).toEqual({
      allowed: false,
      reason: "You cannot disable your own account.",
    });
    expect(canChangeUserRole(admin, admin, "WORKER", 2).allowed).toBe(false);
  });

  it("never removes the last active admin", () => {
    expect(canChangeUserStatus(admin, otherAdmin, "DISABLED", 1).allowed).toBe(false);
    expect(canChangeUserRole(admin, otherAdmin, "SUPERVISOR", 1).allowed).toBe(false);
    expect(canChangeUserStatus(admin, otherAdmin, "DISABLED", 2).allowed).toBe(true);
  });

  it("rejects no-op and non-admin changes", () => {
    expect(canChangeUserStatus(admin, worker, "ACTIVE", 1).allowed).toBe(false);
    expect(canChangeUserStatus(admin, worker, "PENDING", 1).allowed).toBe(false);
    expect(canChangeUserRole(worker, otherAdmin, "WORKER", 2).allowed).toBe(false);
    expect(canChangeUserRole(admin, worker, "SUPERVISOR", 1).allowed).toBe(true);
  });
});
