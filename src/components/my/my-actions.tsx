"use client";

import { ListChecks } from "lucide-react";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { useRepoQuery } from "@/lib/data/hooks";
import { formatCalendarDate } from "@/lib/format";
import { listMyOpenActions } from "@/lib/services/assessments";
import { isOverdue } from "@/lib/services/overdue";

/** Open actions assigned to the signed-in user. Updating and closing them arrives in the findings stage. */
export function MyActions() {
  const user = useCurrentUser();
  const query = useRepoQuery(["actions", "mine", "open", user.id], () => listMyOpenActions(user));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My Actions" description="Actions assigned to you that are not yet closed." />
      <QueryState query={query}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState icon={ListChecks} title="No open actions">
              Actions assigned to you from findings appear here until they are closed.
            </EmptyState>
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {list.map((action) => {
                const overdue = isOverdue(action);
                return (
                  <li key={action.id} className="space-y-1 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-teal">{action.reference}</span>
                      <StatusBadge status={action.status} />
                      {overdue && <Badge className="bg-destructive/10 text-destructive">Overdue</Badge>}
                    </div>
                    <p className="text-sm">{action.description}</p>
                    <p className="text-xs text-muted-foreground">Due {formatCalendarDate(action.targetDate)}</p>
                  </li>
                );
              })}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}
