// MOCK: admin-only demo controls (Settings → Demo data). Removed for production together with the demo panel.

import { assessments, findings, modules, questions, resetDemoData, users, vessels } from "@/lib/data";
import type { Principal } from "@/lib/services/permissions";
import { requireAdmin } from "./shared";

export interface DemoCount {
  label: string;
  value: number;
}

/** Record counts shown above the Reset button. */
export async function loadDemoSummary(actor: Principal): Promise<DemoCount[]> {
  requireAdmin(actor);
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

/** Restores the fixtures and deletes stored photos. Admins only. */
export async function resetDemoDataAs(actor: Principal): Promise<void> {
  requireAdmin(actor);
  await resetDemoData();
}
