"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth, demoLogInAs } from "@/lib/data";
import type { ID, PublicUser } from "@/lib/types";

export const SESSION_QUERY_KEY = ["auth", "session"] as const;

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  /** Rejects with RepositoryError (INVALID_CREDENTIALS, PENDING_APPROVAL, ACCOUNT_DISABLED). */
  logIn(email: string, password: string): Promise<PublicUser>;
  logOut(): Promise<void>;
  /** MOCK: switch to another demo account without a password ("Demo as"). */
  switchUser(userId: ID): Promise<PublicUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => auth.getSessionUser(),
    staleTime: Infinity,
    retry: false,
  });

  /** Starts a fresh session: sets the new user, then refetches everything cached for the previous one. */
  const startSession = useCallback(
    (user: PublicUser) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      void queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== SESSION_QUERY_KEY[0] });
      return user;
    },
    [queryClient],
  );

  const logIn = useCallback(
    async (email: string, password: string) => startSession(await auth.logIn(email, password)),
    [startSession],
  );

  const switchUser = useCallback(async (userId: ID) => startSession(await demoLogInAs(userId)), [startSession]);

  /** Ends the session and reloads on /login, so nothing from the previous user stays in memory. */
  const logOut = useCallback(async () => {
    await auth.logOut();
    window.location.replace("/login");
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session.data ?? null;
    const status: AuthStatus = session.isPending ? "loading" : user ? "authenticated" : "anonymous";
    return { user, status, logIn, logOut, switchUser };
  }, [session.data, session.isPending, logIn, logOut, switchUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** The signed-in user. Only use below <RequireAuth>, where a user is guaranteed. */
export function useCurrentUser(): PublicUser {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser must be used inside <RequireAuth>");
  return user;
}
