// MOCK: sign-in against the demo store. Plain-text passwords, session = user id in localStorage.
// Production replaces this with a real auth provider, hashed passwords and server-side sessions.

import { RepositoryError, type AuthRepository } from "@/lib/data/repositories";
import { SELF_SIGNUP_ROLES, signInBlock } from "@/lib/services/permissions";
import type { ID, PublicUser, User } from "@/lib/types";
import { requireRow, rows } from "./crud";
import { users } from "./reference-repositories";
import { STORAGE_KEY } from "./schema";
import { simulateLatency } from "./utils";

export const SESSION_KEY = `${STORAGE_KEY}-session`;

interface StoredSession {
  userId: ID;
  signedInAt: string;
}

function toPublic(user: User): PublicUser {
  const copy: Partial<User> = structuredClone(user);
  delete copy.password;
  return copy as PublicUser;
}

function readSession(): StoredSession | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(SESSION_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && "userId" in parsed ? (parsed as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeSession(userId: ID | null): void {
  try {
    if (typeof window === "undefined") return;
    if (userId) {
      const session: StoredSession = { userId, signedInAt: new Date().toISOString() };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch (error) {
    console.warn("[MOCK] Could not save the session to localStorage", error);
  }
}

/** Throws the matching sign-in error for PENDING / DISABLED accounts. */
function assertCanSignIn(user: User): void {
  const block = signInBlock(user.status);
  if (block === "PENDING_APPROVAL") {
    throw new RepositoryError(block, "Your account is awaiting approval by an administrator.");
  }
  if (block === "ACCOUNT_DISABLED") {
    throw new RepositoryError(block, "Your account has been disabled. Contact your administrator.");
  }
}

export const auth: AuthRepository = {
  async signUp({ requestedRole, ...details }) {
    if (!(SELF_SIGNUP_ROLES as readonly string[]).includes(requestedRole)) {
      throw new RepositoryError("VALIDATION", "Only the Worker or Supervisor role can be requested");
    }
    return toPublic(await users.create({ ...details, role: requestedRole, status: "PENDING" }));
  },

  async logIn(email, password) {
    await simulateLatency();
    const normalised = email.trim().toLowerCase();
    const user = rows("users").find((u) => u.email.toLowerCase() === normalised);
    // Same message for unknown email and wrong password, so the form never reveals which accounts exist.
    if (!user || user.password !== password) {
      throw new RepositoryError("INVALID_CREDENTIALS", "Incorrect email or password.");
    }
    assertCanSignIn(user);
    writeSession(user.id);
    return toPublic(user);
  },

  async getSessionUser() {
    await simulateLatency();
    const session = readSession();
    if (!session) return null;
    const user = rows("users").find((u) => u.id === session.userId);
    if (!user || user.status !== "ACTIVE") {
      writeSession(null);
      return null;
    }
    return toPublic(user);
  },

  async logOut() {
    await simulateLatency();
    writeSession(null);
  },
};

/** MOCK: passwordless sign-in for demo quick-login and the "Demo as" switcher. */
export async function logInAs(userId: ID): Promise<PublicUser> {
  await simulateLatency();
  const user = requireRow("users", userId, "User");
  assertCanSignIn(user);
  writeSession(user.id);
  return toPublic(user);
}
