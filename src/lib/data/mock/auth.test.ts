import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "@/lib/data/fixtures/users";
import type { RepositoryError } from "@/lib/data/repositories";
import { SESSION_KEY } from "./auth";
import { mockRepositories as repo } from "./index";
import { forgetMemoryState } from "./store";
import { setMockDelay } from "./utils";

const rejectsWith = (promise: Promise<unknown>, code: RepositoryError["code"]) =>
  expect(promise).rejects.toMatchObject({ name: "RepositoryError", code });

const NEW_USER = {
  name: "Ada Obi",
  email: "ada.obi@example.com",
  password: "longenough",
  company: "Deltaport Crewing",
  position: "Crew Member",
  requestedRole: "SUPERVISOR" as const,
};

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("signUp", () => {
  it("creates a PENDING account with the requested role and never returns the password", async () => {
    const user = await repo.auth.signUp(NEW_USER);
    expect(user).toMatchObject({ status: "PENDING", role: "SUPERVISOR", email: "ada.obi@example.com" });
    expect(user).not.toHaveProperty("password");
    expect(await repo.auth.getSessionUser()).toBeNull(); // signing up does not sign you in
  });

  it("rejects a taken email and a self-requested ADMIN role", async () => {
    await rejectsWith(repo.auth.signUp({ ...NEW_USER, email: "ADMIN@example.com" }), "CONFLICT");
    // @ts-expect-error ADMIN cannot be requested at signup
    await rejectsWith(repo.auth.signUp({ ...NEW_USER, requestedRole: "ADMIN" }), "VALIDATION");
  });
});

describe("logIn", () => {
  it("signs in an ACTIVE user (email is case-insensitive) and starts a session", async () => {
    const user = await repo.auth.logIn("  Admin@Example.com ", DEMO_PASSWORD);
    expect(user).toMatchObject({ id: "usr-admin", role: "ADMIN" });
    expect(user).not.toHaveProperty("password");
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toMatchObject({ userId: "usr-admin" });
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await rejectsWith(repo.auth.logIn("admin@example.com", "wrong-password"), "INVALID_CREDENTIALS");
    await rejectsWith(repo.auth.logIn("nobody@example.com", DEMO_PASSWORD), "INVALID_CREDENTIALS");
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("blocks PENDING accounts until approved", async () => {
    await rejectsWith(repo.auth.logIn("samuel.etim@example.com", DEMO_PASSWORD), "PENDING_APPROVAL");
    await repo.users.update("usr-pending-samuel", { status: "ACTIVE" });
    expect(await repo.auth.logIn("samuel.etim@example.com", DEMO_PASSWORD)).toMatchObject({ status: "ACTIVE" });
  });

  it("blocks DISABLED accounts", async () => {
    await rejectsWith(repo.auth.logIn("kunle.ojo@example.com", DEMO_PASSWORD), "ACCOUNT_DISABLED");
    await repo.users.update("usr-wkr-funmi", { status: "DISABLED" });
    await rejectsWith(repo.auth.logIn("funmi.alade@example.com", DEMO_PASSWORD), "ACCOUNT_DISABLED");
  });

  it("checks a pending account's password before revealing its status", async () => {
    await rejectsWith(repo.auth.logIn("samuel.etim@example.com", "wrong-password"), "INVALID_CREDENTIALS");
  });
});

describe("session", () => {
  it("survives a page reload and ends on logout", async () => {
    await repo.auth.logIn("tunde.bakare@example.com", DEMO_PASSWORD);
    forgetMemoryState(); // reload

    expect(await repo.auth.getSessionUser()).toMatchObject({ id: "usr-sup-tunde" });

    await repo.auth.logOut();
    expect(await repo.auth.getSessionUser()).toBeNull();
  });

  it("ends the session if the user is disabled while signed in", async () => {
    await repo.auth.logIn("ibrahim.musa@example.com", DEMO_PASSWORD);
    await repo.users.update("usr-wkr-ibrahim", { status: "DISABLED" });

    expect(await repo.auth.getSessionUser()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("ignores a corrupted session entry", async () => {
    localStorage.setItem(SESSION_KEY, "{broken");
    expect(await repo.auth.getSessionUser()).toBeNull();
  });
});

describe("demo logInAs (Demo as)", () => {
  it("switches between demo accounts without a password", async () => {
    await repo.demo.logInAs("usr-admin");
    expect(await repo.auth.getSessionUser()).toMatchObject({ role: "ADMIN" });

    await repo.demo.logInAs("usr-wkr-ibrahim");
    expect(await repo.auth.getSessionUser()).toMatchObject({ role: "WORKER" });
  });

  it("still refuses pending accounts", async () => {
    await rejectsWith(repo.demo.logInAs("usr-pending-samuel"), "PENDING_APPROVAL");
  });
});
