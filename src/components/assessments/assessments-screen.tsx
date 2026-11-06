"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, ClipboardX, SearchX, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { NativeSelect } from "@/components/forms/native-select";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { QueryState } from "@/components/query-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { questions } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";
import {
  canViewAllAssessments,
  deleteMyDraft,
  listAllAssessmentRows,
  listMyAssessmentRows,
  loadFilterOptions,
  type AllAssessmentsFilter,
  type AssessmentRow,
} from "@/lib/services/assessment-lists";
import { cn } from "@/lib/utils";
import { DraftRow, SubmittedRow } from "./assessment-row";

const FILTER_KEYS = [
  "vessel",
  "location",
  "package",
  "module",
  "auditType",
  "scope",
  "contractor",
  "user",
  "from",
  "to",
  "question",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

/** /assessments: "My assessments" for everyone, "All assessments" (?view=all) for supervisors and admins. */
export function AssessmentsScreen() {
  const user = useCurrentUser();
  const params = useSearchParams();
  const canSeeAll = canViewAllAssessments(user);
  const view = canSeeAll && params.get("view") === "all" ? "all" : "mine";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={view === "all" ? "All assessments" : "My assessments"}
        description={
          view === "all" ? "Submitted assessments across the fleet, newest first." : "Your drafts and submitted assessments."
        }
      />
      {canSeeAll && (
        <div role="tablist" aria-label="Assessments" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:w-fit">
          {(["mine", "all"] as const).map((tab) => (
            <Link
              key={tab}
              role="tab"
              aria-selected={view === tab}
              href={tab === "all" ? "/assessments?view=all" : "/assessments"}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors",
                view === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "all" ? "All assessments" : "My assessments"}
            </Link>
          ))}
        </div>
      )}
      {view === "all" ? <AllAssessments /> : <MyAssessments />}
    </div>
  );
}

function MyAssessments() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const query = useRepoQuery(["assessments", "mine", user.id], () => listMyAssessmentRows(user));
  const [deleting, setDeleting] = useState<AssessmentRow | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteMyDraft(user, deleting.assessment.id);
      await queryClient.invalidateQueries({ queryKey: ["assessments"] });
      toast.success(`Draft ${deleting.assessment.reference} deleted`);
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  return (
    <QueryState query={query}>
      {({ drafts, submitted }) =>
        drafts.length === 0 && submitted.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assessments yet - start one from the hub"
            action={
              <Link href="/" className={buttonVariants()}>
                Go to the hub
              </Link>
            }
          >
            Pick a module, Full Vessel Assurance or a Start Work Check. Drafts and submitted assessments appear here.
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {drafts.length > 0 && (
              <section className="space-y-2" aria-labelledby="drafts-heading">
                <h2 id="drafts-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Drafts ({drafts.length})
                </h2>
                <ul className="divide-y rounded-2xl border bg-card">
                  {drafts.map((row) => (
                    <DraftRow key={row.assessment.id} row={row} onDelete={() => setDeleting(row)} />
                  ))}
                </ul>
              </section>
            )}
            <section className="space-y-2" aria-labelledby="submitted-heading">
              <h2 id="submitted-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Submitted ({submitted.length})
              </h2>
              {submitted.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nothing submitted yet">
                  Finish a draft and submit it to see it here.
                </EmptyState>
              ) : (
                <ul className="divide-y rounded-2xl border bg-card">
                  {submitted.map((row) => (
                    <SubmittedRow key={row.assessment.id} row={row} />
                  ))}
                </ul>
              )}
            </section>
            <ConfirmDialog
              open={deleting !== null}
              onOpenChange={(open) => !open && setDeleting(null)}
              title="Delete this draft?"
              description={`${deleting?.assessment.reference ?? ""} and its answers, photos and prepared findings will be deleted. This can't be undone.`}
              confirmLabel="Delete draft"
              destructive
              onConfirm={confirmDelete}
            />
          </div>
        )
      }
    </QueryState>
  );
}

function AllAssessments() {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const value = (key: FilterKey) => params.get(key) ?? "";
  const filter: AllAssessmentsFilter = {
    vesselId: value("vessel") || undefined,
    locationId: value("location") || undefined,
    moduleId: value("module") || undefined,
    auditTypeId: value("auditType") || undefined,
    packageId: value("package") || undefined,
    company: value("contractor") || undefined,
    scope: value("scope") === "self" || value("scope") === "supervisory" ? (value("scope") as "self" | "supervisory") : undefined,
    questionId: value("question") || undefined,
    userId: value("user") || undefined,
    from: value("from") || undefined,
    to: value("to") || undefined,
  };
  const activeCount = FILTER_KEYS.filter((k) => value(k)).length;
  const datesInvalid = !!filter.from && !!filter.to && filter.from > filter.to;

  const options = useRepoQuery(["assessments", "filter-options"], () => loadFilterOptions(user), { staleTime: 60_000 });
  const question = useRepoQuery(["questions", filter.questionId], () => questions.get(filter.questionId!), {
    enabled: !!filter.questionId,
  });
  const rows = useRepoQuery(["assessments", "all", filter], () => listAllAssessmentRows(user, filter), {
    enabled: !datesInvalid,
  });

  function setFilter(key: FilterKey, next: string) {
    const updated = new URLSearchParams(params.toString());
    if (next) updated.set(key, next);
    else updated.delete(key);
    router.replace(`${pathname}?${updated.toString()}`, { scroll: false });
  }

  function clearFilters() {
    router.replace(`${pathname}?view=all`, { scroll: false });
  }

  const select = (key: FilterKey, label: string, choices: { id: string; name: string; detail?: string }[]) => (
    <div className="space-y-1">
      <Label htmlFor={`filter-${key}`}>{label}</Label>
      <NativeSelect id={`filter-${key}`} value={value(key)} onChange={(e) => setFilter(key, e.target.value)}>
        <option value="">All</option>
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.detail ? ` (${c.detail})` : ""}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 md:hidden">
        <Button variant="outline" className="h-11 flex-1" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <SlidersHorizontal /> Filters{activeCount > 0 && ` (${activeCount})`}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" className="h-11" onClick={clearFilters}>
            <X /> Clear
          </Button>
        )}
      </div>

      <section
        aria-label="Filters"
        className={cn("gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3", showFilters ? "grid" : "hidden md:grid")}
      >
        {options.data ? (
          <>
            {select("vessel", "Vessel", options.data.vessels)}
            {select("location", "Location", options.data.locations)}
            {select("package", "Package", options.data.packages)}
            {select("module", "Module", options.data.modules)}
            {select("auditType", "Audit type", options.data.auditTypes)}
            {select("scope", "Self / Supervisory", [
              { id: "self", name: "Self (Self Assessment, Start Work Check)" },
              { id: "supervisory", name: "Supervisory (MFE, Spot Check, Verification)" },
            ])}
            {select("contractor", "Contractor", options.data.companies.map((c) => ({ id: c, name: c })))}
            {select(
              "user",
              "Submitted by",
              options.data.users.map((u) => ({ id: u.id, name: u.name, detail: u.company })),
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="filter-from">From</Label>
                <Input
                  id="filter-from"
                  type="date"
                  className={INPUT_CLASS}
                  value={value("from")}
                  max={value("to") || undefined}
                  onChange={(e) => setFilter("from", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-to">To</Label>
                <Input
                  id="filter-to"
                  type="date"
                  className={INPUT_CLASS}
                  value={value("to")}
                  min={value("from") || undefined}
                  aria-invalid={datesInvalid || undefined}
                  onChange={(e) => setFilter("to", e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading filters…</p>
        )}
        {activeCount > 0 && (
          <div className="hidden items-end md:flex">
            <Button variant="ghost" className="h-11" onClick={clearFilters}>
              <X /> Clear filters
            </Button>
          </div>
        )}
      </section>

      {filter.questionId && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <ClipboardX className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Answered No to: <span className="font-medium">{question.data?.text ?? "…"}</span>
          </span>
          <button
            type="button"
            onClick={() => setFilter("question", "")}
            className="inline-flex h-11 items-center gap-1 rounded-full border border-red-300 bg-white px-4 text-sm"
            aria-label="Remove the question filter"
          >
            <X className="size-3.5" aria-hidden /> Remove
          </button>
        </p>
      )}

      {datesInvalid ? (
        <p className="text-sm text-destructive">The “To” date is before the “From” date.</p>
      ) : (
        <QueryState query={rows}>
          {(list) => (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {list.length} assessment{list.length === 1 ? "" : "s"}
                {activeCount > 0 && " match the filters"}
              </p>
              {list.length === 0 ? (
                activeCount > 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No assessments match these filters"
                    action={
                      <Button variant="outline" onClick={clearFilters}>
                        <X /> Clear filters
                      </Button>
                    }
                  >
                    Try a wider date range or fewer filters.
                  </EmptyState>
                ) : (
                  <EmptyState icon={ClipboardList} title="No submitted assessments yet">
                    Submitted assessments from across the fleet will appear here.
                  </EmptyState>
                )
              ) : (
                <PagedRows key={params.toString()} list={list} />
              )}
            </div>
          )}
        </QueryState>
      )}
    </div>
  );
}

const PAGE_SIZE = 25;

/** Long lists are shown 25 at a time so phones are not asked to draw hundreds of rows at once. */
function PagedRows({ list }: { list: AssessmentRow[] }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = list.slice(0, shown);
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-2xl border bg-card">
        {visible.map((row) => (
          <SubmittedRow key={row.assessment.id} row={row} showSubmitter />
        ))}
      </ul>
      {list.length > shown && (
        <div className="flex flex-col items-center gap-1">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, list.length - shown)} more
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {shown} of {list.length}
          </p>
        </div>
      )}
    </div>
  );
}
