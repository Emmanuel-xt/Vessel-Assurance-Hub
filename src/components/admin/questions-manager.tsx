"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Camera, FileUp, Pencil, Plus, Power, PowerOff, Search, SearchX, ShieldAlert, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { QuestionFormSheet } from "@/components/admin/question-form-sheet";
import { QuestionImportSheet } from "@/components/admin/question-import-sheet";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auditTypes, modules, questions, riskCategories, vesselTypes } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import type { MoveDirection } from "@/lib/services/ordering";
import { deleteQuestion, moveQuestion, setQuestionActive } from "@/lib/services/questions";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

async function loadQuestionData() {
  const [questionList, moduleList, riskList, typeList, auditList, answered] = await Promise.all([
    questions.list(),
    modules.list(),
    riskCategories.list(),
    vesselTypes.list(),
    auditTypes.list(),
    questions.listAnsweredIds(),
  ]);
  return {
    questions: questionList,
    modules: moduleList,
    riskCategories: riskList,
    vesselTypes: typeList,
    auditTypes: auditList,
    answered: new Set(answered),
  };
}

type StatusFilter = "active" | "inactive" | "all";

export function QuestionsManager() {
  const query = useRepoQuery(["questions", "admin"], loadQuestionData);
  const [moduleId, setModuleId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ question: Question | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const invalidates = [["questions"], ["modules"]];
  const move = useAdminAction((actor, v: { question: Question; direction: MoveDirection }) => moveQuestion(actor, v.question.id, v.direction), {
    success: (_r, v) => `Question moved ${v.direction}`,
    invalidates,
  });
  const toggle = useAdminAction((actor, q: Question) => setQuestionActive(actor, q.id, !q.active), {
    success: (q) => (q.active ? "Question reactivated" : "Question deactivated"),
    invalidates,
  });
  const remove = useAdminAction((actor, q: Question) => deleteQuestion(actor, q.id), {
    success: () => "Question deleted",
    invalidates,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions"
        description="The question bank behind every assessment. Answered questions are deactivated, never deleted."
        actions={
          <>
            <Button variant="outline" className="h-10" disabled={!query.data} onClick={() => setImportOpen(true)}>
              <FileUp /> Import CSV
            </Button>
            <Button className="h-10" disabled={!query.data} onClick={() => setEditing({ question: null })}>
              <Plus /> Add question
            </Button>
          </>
        }
      />

      <QueryState query={query}>
        {(data) => {
          const nameOf = <T extends { id: string; name: string }>(items: T[], id: string) =>
            items.find((i) => i.id === id)?.name ?? "—";
          const term = search.trim().toLowerCase();
          const shown = data.questions
            .filter(
              (q) =>
                (!moduleId || q.moduleId === moduleId) &&
                (status === "all" || (status === "active") === q.active) &&
                (!term || q.text.toLowerCase().includes(term)),
            )
            .sort(
              (a, b) =>
                (data.modules.find((m) => m.id === a.moduleId)?.displayOrder ?? 0) -
                  (data.modules.find((m) => m.id === b.moduleId)?.displayOrder ?? 0) || a.displayOrder - b.displayOrder,
            );
          // Reordering only makes sense within one module, over its full list.
          const canReorder = moduleId !== "" && status === "all" && !term;
          const restrictions = (q: Question) =>
            [
              q.vesselTypeIds.length > 0 && `Vessels: ${q.vesselTypeIds.map((id) => nameOf(data.vesselTypes, id)).join(", ")}`,
              q.auditTypeIds.length > 0 && `Audits: ${q.auditTypeIds.map((id) => nameOf(data.auditTypes, id)).join(", ")}`,
            ].filter(Boolean) as string[];

          return (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search questions"
                    placeholder="Search question text…"
                    className={`${INPUT_CLASS} pl-9`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <NativeSelect aria-label="Filter by module" className="sm:w-56" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                  <option value="">All modules</option>
                  {data.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label="Filter by status"
                  className="sm:w-36"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </NativeSelect>
              </div>

              <p className="text-sm text-muted-foreground">
                Showing {shown.length} of {data.questions.length} questions.
                {!canReorder && " To reorder, choose one module, set status to All and clear the search."}
              </p>

              {shown.length === 0 ? (
                <EmptyState icon={SearchX} title="No questions match these filters">
                  Try another search, module or status.
                </EmptyState>
              ) : (
                <ol className="divide-y rounded-xl border bg-card">
                  {shown.map((q, index) => {
                    const answered = data.answered.has(q.id);
                    return (
                      <li key={q.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row", !q.active && "bg-muted/40")}>
                        {canReorder && (
                          <div className="flex items-center gap-1 sm:flex-col sm:justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-10"
                              aria-label="Move up"
                              disabled={index === 0 || move.isPending}
                              onClick={() => move.mutate({ question: q, direction: "up" })}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-10"
                              aria-label="Move down"
                              disabled={index === shown.length - 1 || move.isPending}
                              onClick={() => move.mutate({ question: q, direction: "down" })}
                            >
                              <ArrowDown />
                            </Button>
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className={cn("text-sm", !q.active && "text-muted-foreground")}>{q.text}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {!moduleId && <Badge variant="outline">{nameOf(data.modules, q.moduleId)}</Badge>}
                            <Badge variant="secondary">{nameOf(data.riskCategories, q.riskCategoryId)}</Badge>
                            <Badge variant="secondary">Weight {q.weight}</Badge>
                            {q.criticalControl && (
                              <Badge className="bg-destructive/10 text-destructive">
                                <ShieldAlert /> Critical
                              </Badge>
                            )}
                            {q.evidenceRequired && (
                              <Badge className="bg-accent text-accent-foreground">
                                <Camera /> Evidence
                              </Badge>
                            )}
                            {!q.active && <Badge variant="outline">Inactive</Badge>}
                            {answered && <Badge variant="outline">Answered</Badge>}
                          </div>
                          {restrictions(q).map((r) => (
                            <p key={r} className="text-xs text-muted-foreground">
                              {r}
                            </p>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                          <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing({ question: q })}>
                            <Pencil /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            disabled={toggle.isPending}
                            onClick={() => toggle.mutate(q)}
                          >
                            {q.active ? (
                              <>
                                <PowerOff /> Deactivate
                              </>
                            ) : (
                              <>
                                <Power /> Reactivate
                              </>
                            )}
                          </Button>
                          {!answered && (
                            <Button variant="outline" size="sm" className="h-9 text-destructive" onClick={() => setDeleting(q)}>
                              <Trash2 /> Delete
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <QuestionFormSheet
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                question={editing?.question ?? null}
                defaultModuleId={moduleId}
                modules={data.modules}
                riskCategories={data.riskCategories}
                vesselTypes={data.vesselTypes}
                auditTypes={data.auditTypes}
              />
              <QuestionImportSheet
                open={importOpen}
                onOpenChange={setImportOpen}
                questions={data.questions}
                modules={data.modules}
                riskCategories={data.riskCategories}
                vesselTypes={data.vesselTypes}
                auditTypes={data.auditTypes}
              />
            </>
          );
        }}
      </QueryState>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this question?"
        description={
          <>
            &ldquo;{deleting?.text}&rdquo; has never been answered, so it can be deleted permanently. This cannot be
            undone. To keep it for later, deactivate it instead.
          </>
        }
        confirmLabel="Delete question"
        destructive
        onConfirm={() => remove.mutateAsync(deleting!)}
      />
    </div>
  );
}
