"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, ClipboardList, HardHat, ListTodo, Ship } from "lucide-react";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { HubWelcome } from "@/components/hub/hub-welcome";
import { ModuleIcon } from "@/components/hub/module-icon";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { questions } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { listMyOpenActions, modulesFor } from "@/lib/services/assessments";
import { EmptyState } from "@/components/admin/page-header";
import {
  canAccessAdmin,
  canInitiateStartWork,
  canStartFullVessel,
  canViewDashboard,
  modulesVisibleTo,
} from "@/lib/services/permissions";
import { countOpenActivities } from "@/lib/services/start-work-activities";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

async function loadTiles(role: Role) {
  const [assurance, startWork, activeQuestions] = await Promise.all([
    modulesFor("MODULE"),
    modulesFor("START_WORK"),
    questions.list({ activeOnly: true }),
  ]);
  const questionCount = (moduleId: string) => activeQuestions.filter((q) => q.moduleId === moduleId).length;
  return {
    /** The LOD 1 Self Assessment list: only the modules this role sees. */
    modules: modulesVisibleTo(role, assurance).map((m) => ({ ...m, questionCount: questionCount(m.id) })),
    /** Full Vessel Assurance covers every active Assurance module, whoever runs it. */
    fullVesselCount: assurance.length,
    startWorkCount: startWork.length,
  };
}

const TILE = "flex rounded-2xl border p-4 transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

export function HubHome() {
  const user = useCurrentUser();
  const tiles = useRepoQuery(["modules", "hub", user.role], () => loadTiles(user.role));
  const fullVessel = canStartFullVessel(user);
  const initiator = canInitiateStartWork(user);
  const openChecks = useRepoQuery(["startWorkActivities", "open-count"], () => countOpenActivities(user));
  const openCount = openChecks.data ?? 0;
  const openActions = useRepoQuery(["actions", "mine", "open", user.id], () => listMyOpenActions(user));

  return (
    <div className="space-y-8">
      <HubWelcome />

      <QueryState query={tiles} skeletonRows={4}>
        {({ modules, fullVesselCount, startWorkCount }) =>
          modules.length === 0 && startWorkCount === 0 ? (
            <EmptyState icon={Ship} title="No modules are available yet">
              {canAccessAdmin(user)
                ? "Activate at least one module in Admin → Modules to start assessing."
                : "An administrator needs to set up the assessment modules. Please check back later."}
            </EmptyState>
          ) : (
          <>
            <section aria-label="Start an assessment" className="grid gap-3 sm:grid-cols-2">
              {startWorkCount > 0 && (
                <Link
                  href="/start-work"
                  className={cn(TILE, "min-h-32 items-center gap-4 border-teal bg-teal text-teal-foreground shadow-md hover:bg-teal/90")}
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <HardHat className="size-8" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                      {initiator ? "Start Work Check" : "Join a Start Work Check"}
                      {openCount > 0 && (
                        <Badge className="bg-white/20 text-teal-foreground">{openCount} open</Badge>
                      )}
                    </span>
                    <span className="block text-sm text-teal-foreground/90">
                      {initiator
                        ? "Set one up for a job, share the code, close it when the crew is cleared."
                        : "Enter the code from your auditor, or pick an open check."}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              )}
              {fullVessel && fullVesselCount > 0 && (
                <Link
                  href="/assess/new?module=full-vessel"
                  className={cn(TILE, "min-h-32 items-center gap-4 border-navy bg-navy text-navy-foreground shadow-md hover:bg-navy/90")}
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Ship className="size-8 text-teal" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">Full Vessel Assurance</span>
                    <span className="block text-sm text-navy-foreground/80">
                      All {fullVesselCount} assurance modules for one vessel.
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              )}
            </section>

            {modules.length > 0 && (
            <section aria-labelledby="modules-heading" className="space-y-3">
              <h2 id="modules-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                LOD 1 Self Assessment Module
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {modules.map((module) => (
                  <li key={module.id}>
                    <Link
                      href={`/assess/new?module=${encodeURIComponent(module.id)}`}
                      className={cn(TILE, "h-full min-h-28 flex-col gap-2 bg-card hover:border-teal hover:bg-accent/40")}
                    >
                      <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <ModuleIcon moduleId={module.id} className="size-5" />
                      </span>
                      <span className="text-sm leading-snug font-medium">{module.name}</span>
                      <span className="mt-auto text-xs text-muted-foreground">{module.questionCount} questions</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            )}
          </>
          )
        }
      </QueryState>

      <nav aria-label="Your work" className="grid gap-2 sm:grid-cols-3">
        <QuickLink href="/assessments" icon={ClipboardList} label="My Assessments" />
        <QuickLink
          href="/my/actions"
          icon={ListTodo}
          label="My Actions"
          badge={openActions.data ? `${openActions.data.length} open` : undefined}
          highlight={(openActions.data?.length ?? 0) > 0}
        />
        {canViewDashboard(user) && <QuickLink href="/dashboard" icon={BarChart3} label="Dashboard" />}
      </nav>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  badge,
  highlight,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex h-14 items-center gap-3 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <Icon className="size-5 text-teal" aria-hidden />
      <span className="flex-1">{label}</span>
      {badge && (
        <Badge className={highlight ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"}>{badge}</Badge>
      )}
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
