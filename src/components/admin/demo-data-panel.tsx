"use client";

import { useState } from "react";
import { Database, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { assessments, findings, modules, questions, users, vessels } from "@/lib/data";
import { useRepoQuery, useResetDemoData } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";

async function loadSummary() {
  const [vesselList, moduleList, questionList, userList, assessmentList, findingList] = await Promise.all([
    vessels.list(),
    modules.list({ activeOnly: true }),
    questions.list({ activeOnly: true }),
    users.list(),
    assessments.listSubmitted(),
    findings.list(),
  ]);
  return [
    { label: "Vessels", value: vesselList.length },
    { label: "Modules", value: moduleList.length },
    { label: "Questions", value: questionList.length },
    { label: "Users", value: userList.length },
    { label: "Assessments", value: assessmentList.length },
    { label: "Findings", value: findingList.length },
  ];
}

/** MOCK: demo data summary and the "Reset demo data" button. Removed for production. */
export function DemoDataPanel() {
  const summary = useRepoQuery(["demo-summary"], loadSummary);
  const reset = useResetDemoData();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function resetNow() {
    try {
      await reset.mutateAsync();
      toast.success("Demo data restored to the original fixtures");
    } catch (error) {
      toast.error(`Could not reset demo data: ${errorMessage(error)}`);
      throw error;
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Database className="size-5 text-teal" aria-hidden />
        <h2 className="font-medium">Demo data</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Everything in this prototype is stored in this browser. Resetting restores the original vessels, users, modules
        and questions, and deletes all assessments, findings and photos created since.
      </p>

      <QueryState query={summary} skeletonRows={2}>
        {(items) => (
          <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {items.map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </QueryState>

      <Button variant="destructive" className="h-11" onClick={() => setConfirmOpen(true)}>
        <RotateCcw /> Reset demo data
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reset all demo data?"
        description="All changes made in this browser will be lost: new users, vessels, edits, assessments, findings and photos. This cannot be undone."
        confirmLabel="Reset demo data"
        destructive
        onConfirm={resetNow}
      />
    </section>
  );
}
