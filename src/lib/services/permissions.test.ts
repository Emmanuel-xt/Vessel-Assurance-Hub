import { describe, expect, it } from "vitest";
import { AUDIT_TYPES } from "@/lib/data/fixtures/lookups";
import {
  canAccessAdmin,
  canChangeUserRole,
  canChangeUserStatus,
  canUseAuditType,
  canViewDashboard,
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
  it("limits workers to Self Assessment and Start Work Check", () => {
    expect(allowedCodes("WORKER")).toEqual(["SELF_ASSESSMENT", "START_WORK_CHECK"]);
  });

  it("gives supervisors and admins every audit type", () => {
    const all = AUDIT_TYPES.map((t) => t.code);
    expect(allowedCodes("SUPERVISOR")).toEqual(all);
    expect(allowedCodes("ADMIN")).toEqual(all);
  });

  it("follows admin edits and never allows an inactive audit type", () => {
    expect(canUseAuditType("WORKER", { allowedRoles: ["WORKER", "SUPERVISOR"], active: true })).toBe(true);
    expect(canUseAuditType("ADMIN", { allowedRoles: ["ADMIN"], active: false })).toBe(false);
  });
});

describe("area access", () => {
  it("opens admin to admins only and the dashboard to supervisors and admins", () => {
    expect([canAccessAdmin(person("ADMIN")), canAccessAdmin(person("SUPERVISOR"))]).toEqual([true, false]);
    expect([canViewDashboard(person("WORKER")), canViewDashboard(person("SUPERVISOR"))]).toEqual([false, true]);
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
