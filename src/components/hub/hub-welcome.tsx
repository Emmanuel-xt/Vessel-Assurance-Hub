"use client";

import { useCurrentUser } from "@/components/auth/auth-provider";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants";
import { auditTypes } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { canUseAuditType } from "@/lib/services/permissions";

/** Placeholder hub greeting: shows who is signed in and which audit types their role may use. */
export function HubWelcome() {
  const user = useCurrentUser();
  const types = useRepoQuery(["auditTypes", { activeOnly: true }], () => auditTypes.list({ activeOnly: true }));

  return (
    <section className="rounded-xl bg-navy p-5 text-navy-foreground">
      <h1>
        <span className="block text-sm font-normal text-navy-foreground/75">Welcome aboard</span>
        <span className="mt-1 block text-2xl font-semibold tracking-tight">{user.name}</span>
      </h1>
      <p className="mt-1 text-sm text-navy-foreground/80">
        {ROLE_LABELS[user.role]} · {user.position} · {user.company}
      </p>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy-foreground/60">
          Audit types you can use
        </p>
        <QueryState query={types} loading={<div className="h-6 w-48 animate-pulse rounded bg-navy-foreground/20" />}>
          {(list) => (
            <div className="flex flex-wrap gap-2">
              {list
                .filter((type) => canUseAuditType(user.role, type))
                .map((type) => (
                  <Badge key={type.id} className="bg-teal text-teal-foreground">
                    {type.name}
                  </Badge>
                ))}
            </div>
          )}
        </QueryState>
      </div>
    </section>
  );
}
