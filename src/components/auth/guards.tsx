"use client";

// MOCK: client-side route guards. The session lives in localStorage, so the server cannot see it.
// Production must also enforce these checks on the server (CLAUDE.md §14).

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { NoAccessState } from "@/components/status-screen";
import { safeNextPath } from "@/lib/navigation";
import { hasRole } from "@/lib/services/permissions";
import type { Role } from "@/lib/types";
import { useAuth } from "./auth-provider";

function FullScreenLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status" aria-label="Loading">
      <LogoMark className="size-11 animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export { safeNextPath };

/** Renders children only for a signed-in user; otherwise sends them to /login?next=<current page>. */
export function RequireAuth({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [status, pathname, router]);

  if (status !== "authenticated") return <FullScreenLoader />;
  return <>{children}</>;
}

/** Renders children only for the given roles; everyone else sees an access-denied message. */
export function RequireRole({
  roles,
  message = "This area is for administrators only.",
  children,
}: Readonly<{ roles: Role[]; message?: string; children: React.ReactNode }>) {
  const { user } = useAuth();
  if (hasRole(user, ...roles)) return <>{children}</>;

  return <NoAccessState message={message} />;
}

function RedirectIfAuthenticatedInner({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useAuth();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  if (status !== "anonymous") return <FullScreenLoader />;
  return <>{children}</>;
}

/** For /login and /signup: a signed-in user is sent on to ?next= (or the hub). */
export function RedirectIfAuthenticated({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <RedirectIfAuthenticatedInner>{children}</RedirectIfAuthenticatedInner>
    </Suspense>
  );
}
