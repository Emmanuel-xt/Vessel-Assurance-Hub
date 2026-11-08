import { beforeEach, describe, expect, it } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import { createLocation, renameLocation, setLocationActive } from "@/lib/services/admin/locations";
import { moveModule, saveModule } from "@/lib/services/admin/modules";
import {
  approveUser,
  changeUserRole,
  disableUser,
  listUsersForAdmin,
  reEnableUser,
  rejectUser,
} from "@/lib/services/admin/users";
import { saveVessel, setVesselStatus, type VesselFormValues } from "@/lib/services/admin/vessels";
import { loadDemoSummary, resetDemoDataAs } from "@/lib/services/admin/demo";
import type { Principal } from "@/lib/services/permissions";
import type { Role } from "@/lib/types";

const admin: Principal = { id: "usr-admin", role: "ADMIN", status: "ACTIVE" };
const supervisor: Principal = { id: "usr-sup-tunde", role: "SUPERVISOR", status: "ACTIVE" };

const forbidden = { name: "PermissionError", code: "FORBIDDEN" };
const invalid = (field: string) => ({ name: "ValidationError", fieldErrors: { [field]: expect.any(String) } });

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("role check", () => {
  it("rejects every admin action for non-admins", async () => {
    await expect(listUsersForAdmin(supervisor)).rejects.toMatchObject(forbidden);
    await expect(createLocation(supervisor, { name: "Escravos" })).rejects.toMatchObject(forbidden);
    await expect(setVesselStatus(supervisor, "ves-fds", "INACTIVE")).rejects.toMatchObject(forbidden);
    await expect(moveModule(supervisor, "mod-galley", "up")).rejects.toMatchObject(forbidden);
  });
});

describe("users", () => {
  it("lists pending users first and never exposes passwords", async () => {
    const list = await listUsersForAdmin(admin);
    expect(list[0]).toMatchObject({ status: "PENDING", name: "Samuel Etim" });
    expect(list.every((u) => !("password" in u))).toBe(true);
  });

  it("approves and rejects pending accounts only", async () => {
    expect(await approveUser(admin, "usr-pending-samuel")).toMatchObject({ status: "ACTIVE" });
    await expect(rejectUser(admin, "usr-pending-samuel")).rejects.toMatchObject(forbidden);

    const signup = await repo.auth.signUp({
      name: "New Person",
      email: "new.person@example.com",
      password: "longenough",
      company: "Coastway Marine",
      position: "Crew Member",
      requestedRole: "WORKER",
    });
    expect(await rejectUser(admin, signup.id)).toMatchObject({ status: "DISABLED" });
  });

  it("disables and re-enables accounts", async () => {
    expect(await disableUser(admin, "usr-wkr-funmi")).toMatchObject({ status: "DISABLED" });
    expect(await reEnableUser(admin, "usr-wkr-funmi")).toMatchObject({ status: "ACTIVE" });
  });

  it("stops admins disabling themselves or changing their own role", async () => {
    await expect(disableUser(admin, "usr-admin")).rejects.toMatchObject({
      ...forbidden,
      message: "You cannot disable your own account.",
    });
    await expect(changeUserRole(admin, "usr-admin", "WORKER")).rejects.toMatchObject(forbidden);
  });

  it("lets one admin demote another while two admins exist", async () => {
    await changeUserRole(admin, "usr-sup-tunde", "ADMIN");
    const tunde: Principal = { id: "usr-sup-tunde", role: "ADMIN", status: "ACTIVE" };
    expect(await changeUserRole(tunde, "usr-admin", "SUPERVISOR")).toMatchObject({ role: "SUPERVISOR" });
  });

  it("changes roles", async () => {
    expect(await changeUserRole(admin, "usr-wkr-blessing", "SUPERVISOR")).toMatchObject({ role: "SUPERVISOR" });
  });

  it("rejects an unknown role", async () => {
    await expect(changeUserRole(admin, "usr-wkr-blessing", "OWNER" as Role)).rejects.toMatchObject(invalid("role"));
  });
});

describe("demo data (MOCK)", () => {
  it("only admins can see the counts or reset", async () => {
    await expect(loadDemoSummary(supervisor)).rejects.toMatchObject(forbidden);
    await expect(resetDemoDataAs(supervisor)).rejects.toMatchObject(forbidden);
    await expect(resetDemoDataAs({ id: "usr-wkr-ibrahim", role: "WORKER", status: "ACTIVE" })).rejects.toMatchObject(forbidden);
  });

  it("resets for an admin", async () => {
    await createLocation(admin, { name: "Escravos" });
    await resetDemoDataAs(admin);
    expect((await repo.locations.list()).some((l) => l.name === "Escravos")).toBe(false);
    expect(await loadDemoSummary(admin)).toContainEqual({ label: "Vessels", value: 41 });
  });
});

describe("vessels", () => {
  const base: VesselFormValues = {
    name: "MV Example",
    vesselTypeName: "PSV",
    packageId: "pkg-epc1",
    defaultLocationId: "loc-bonny",
    contractor: "",
    status: "ACTIVE",
  };

  it("adds a vessel using an existing type (matched case-insensitively)", async () => {
    const vessel = await saveVessel(admin, null, { ...base, vesselTypeName: " psv " });
    expect(vessel).toMatchObject({ name: "MV Example", vesselTypeId: "vt-psv", contractor: null });
    expect(await repo.vesselTypes.list()).toHaveLength(8);
  });

  it("creates a new vessel type from free text", async () => {
    const vessel = await saveVessel(admin, null, { ...base, vesselTypeName: "MSV" });
    const types = await repo.vesselTypes.list();
    expect(types).toHaveLength(9);
    expect(types.find((t) => t.id === vessel.vesselTypeId)?.name).toBe("MSV");
  });

  it("rejects duplicate names and missing fields", async () => {
    await expect(saveVessel(admin, null, { ...base, name: "fds" })).rejects.toMatchObject(invalid("name"));
    await expect(saveVessel(admin, null, { ...base, packageId: "" })).rejects.toMatchObject(invalid("packageId"));
  });

  it("edits a vessel, keeping its own name allowed", async () => {
    const edited = await saveVessel(admin, "ves-fds", { ...base, name: "FDS", contractor: "Example Ops" });
    expect(edited).toMatchObject({ id: "ves-fds", contractor: "Example Ops", packageId: "pkg-epc1" });
  });

  it("deactivates instead of deleting", async () => {
    await setVesselStatus(admin, "ves-fds", "INACTIVE");
    expect(await repo.vessels.get("ves-fds")).toMatchObject({ status: "INACTIVE" });
    expect(await repo.vessels.list()).toHaveLength(41);
  });
});

describe("locations", () => {
  it("adds, renames and deactivates with unique names", async () => {
    const location = await createLocation(admin, { name: "Escravos" });
    await expect(createLocation(admin, { name: "bonga" })).rejects.toMatchObject(invalid("name"));
    expect(await renameLocation(admin, location.id, { name: "Escravos Terminal" })).toMatchObject({
      name: "Escravos Terminal",
    });
    expect(await setLocationActive(admin, location.id, false)).toMatchObject({ active: false });
  });
});

describe("modules", () => {
  it("adds new modules at the end", async () => {
    const created = await saveModule(admin, null, {
      name: "Diving Operations",
      description: "",
      category: "START_WORK",
      active: true,
    });
    expect(created.displayOrder).toBe(18);
  });

  it("reorders modules", async () => {
    await moveModule(admin, "mod-bridge-team", "up");
    const order = (await repo.modules.list()).map((m) => m.id);
    expect(order.slice(0, 2)).toEqual(["mod-bridge-team", "mod-marine-start-work"]);
  });

  it("rejects a duplicate module name", async () => {
    await expect(
      saveModule(admin, null, { name: "Galley", description: "", category: "ASSURANCE", active: true }),
    ).rejects.toMatchObject(invalid("name"));
  });
});
