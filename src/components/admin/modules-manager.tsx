"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { CATEGORY_LABELS, ModuleFormSheet } from "@/components/admin/module-form-sheet";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { ActiveBadge } from "@/components/admin/status-badge";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { modules, questions } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { moveModule, setModuleActive } from "@/lib/services/admin/modules";
import type { MoveDirection } from "@/lib/services/ordering";
import type { Module } from "@/lib/types";

async function loadModuleData() {
  const [moduleList, questionList] = await Promise.all([modules.list(), questions.list({ activeOnly: true })]);
  const questionCount = new Map<string, number>();
  for (const q of questionList) questionCount.set(q.moduleId, (questionCount.get(q.moduleId) ?? 0) + 1);
  return { modules: moduleList, questionCount };
}

export function ModulesManager() {
  const query = useRepoQuery(["modules", "admin"], loadModuleData);
  const [editing, setEditing] = useState<{ module: Module | null } | null>(null);

  const move = useAdminAction((actor, v: { module: Module; direction: MoveDirection }) => moveModule(actor, v.module.id, v.direction), {
    success: (_r, v) => `${v.module.name} moved ${v.direction}`,
    invalidates: [["modules"]],
  });
  const toggle = useAdminAction((actor, m: Module) => setModuleActive(actor, m.id, !m.active), {
    success: (m) => `${m.name} ${m.active ? "reactivated" : "deactivated"}`,
    invalidates: [["modules"]],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modules"
        description="The order here is the order on the hub. Deactivated modules are hidden; their questions are kept."
        actions={
          <Button className="h-10" onClick={() => setEditing({ module: null })}>
            <Plus /> Add module
          </Button>
        }
      />

      <QueryState query={query}>
        {({ modules: list, questionCount }) =>
          list.length === 0 ? (
            <EmptyState title="No modules yet">Add a module, then give it questions in the question bank.</EmptyState>
          ) : (
            <ol className="divide-y rounded-xl border bg-card">
              {list.map((module, index) => {
                const count = questionCount.get(module.id) ?? 0;
                return (
                  <li key={module.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10"
                        aria-label={`Move ${module.name} up`}
                        disabled={index === 0 || move.isPending}
                        onClick={() => move.mutate({ module, direction: "up" })}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10"
                        aria-label={`Move ${module.name} down`}
                        disabled={index === list.length - 1 || move.isPending}
                        onClick={() => move.mutate({ module, direction: "down" })}
                      >
                        <ArrowDown />
                      </Button>
                      <span className="w-6 text-center text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{module.name}</span>
                        <Badge variant="outline">{CATEGORY_LABELS[module.category]}</Badge>
                        <ActiveBadge active={module.active} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {count} active question{count === 1 ? "" : "s"}
                        {module.description && ` · ${module.description}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing({ module })}>
                        <Pencil /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate(module)}
                      >
                        {module.active ? (
                          <>
                            <PowerOff /> Deactivate
                          </>
                        ) : (
                          <>
                            <Power /> Reactivate
                          </>
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )
        }
      </QueryState>

      <ModuleFormSheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} module={editing?.module ?? null} />
    </div>
  );
}
