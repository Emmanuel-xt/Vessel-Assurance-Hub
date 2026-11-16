"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight, SearchX, ShieldAlert } from "lucide-react";
import { formatScore, scoreTone } from "@/components/assess/answer-style";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { useCurrentUser } from "@/components/auth/auth-provider";
import { QueryState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { useRepoQuery } from "@/lib/data/hooks";
import {
  ALL_VESSELS,
  DEFAULT_FILTER,
  GAP_WARNING_POINTS,
  PRESET_LABELS,
  assessmentsLink,
  computeDashboard,
  dashboardLayoutFor,
  dashboardQuery,
  loadDashboardData,
  parseDashboardFilter,
  prepareDashboardData,
  type DashboardFilter,
  type DashboardLayout,
  type DashboardView,
  type DrillDown,
  type PreparedData,
  type ScoreRow,
} from "@/lib/services/dashboard";
import { scoreBandLabel } from "@/lib/services/scoring";
import { cn } from "@/lib/utils";
import { ChartCard } from "./chart-card";
import { FindingsChart, ScoreBars, SelfVsSupervisoryChart, TrendChart } from "./charts";
import { ExportButton } from "./export-button";
import { FilterBar } from "./filter-bar";
import { FollowUpLists } from "./follow-up";
import { KpiCards } from "./kpi-cards";
import { ModuleTiles } from "./module-tiles";
import { StartWorkFailures } from "./start-work-failures";

const TITLES: Record<DashboardLayout["role"], string> = {
  ADMIN: "Dashboard",
  AUDITOR: "Auditor dashboard",
  SUPERVISOR: "Dashboard",
};

const DESCRIPTIONS: Record<DashboardLayout["role"], string> = {
  ADMIN: "Fleet assurance trends and where Start Work Checks fail. Tap a bar or tile to filter; every chart links to its assessments.",
  AUDITOR: "What needs your follow-up: overdue findings, Start Work STOPs and Good Practice, then where Start Work Checks fail.",
  SUPERVISOR: "Fleet assurance trends (read-only). Tap a bar or tile to filter; every chart links to its assessments.",
};

type DimensionKey = "vesselId" | "locationId" | "moduleId" | "packageId";

/**
 * /dashboard: supervisors and auditors (read-only) and admins, each with their own layout (`dashboardLayoutFor`).
 * All numbers come from src/lib/services/dashboard.ts.
 */
export function DashboardScreen() {
  const user = useCurrentUser();
  const query = useRepoQuery(["dashboard", "data"], () => loadDashboardData(user), { staleTime: 60_000 });
  return (
    <QueryState query={query} skeletonRows={6}>
      {(data) => <Dashboard raw={data} />}
    </QueryState>
  );
}

function Dashboard({ raw }: { raw: Parameters<typeof prepareDashboardData>[0] }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramString = params.toString();

  // Prepared once per load; recomputed only when the filter in the URL changes.
  const data = useMemo(() => prepareDashboardData(raw), [raw]);
  const filter = useMemo(() => parseDashboardFilter(new URLSearchParams(paramString)), [paramString]);
  const view = useMemo(() => computeDashboard(data, filter), [data, filter]);
  const layout = dashboardLayoutFor(user.role);

  const apply = useCallback(
    (next: DashboardFilter) => {
      const query = dashboardQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
  const change = useCallback((patch: Partial<DashboardFilter>) => apply({ ...filter, ...patch }), [apply, filter]);

  const link = (extra: DrillDown = {}) => assessmentsLink(filter, view.period, extra);
  const selectDimension = (key: DimensionKey) => (row: { id: string }) => change({ [key]: row.id });

  return (
    <div className="space-y-5">
      <PageHeader
        title={TITLES[layout.role]}
        description={DESCRIPTIONS[layout.role]}
        actions={<ExportButton data={data} assessments={view.assessments} period={view.period} />}
      />

      <FilterBar filter={filter} period={view.period} data={data} onChange={change} onReset={() => apply(DEFAULT_FILTER)} />

      {layout.role === "AUDITOR" && (
        <p className="text-sm text-muted-foreground">
          Fleet score this period:{" "}
          <span className={cn("font-semibold", scoreTone(view.kpis.fleetScore))}>
            {formatScore(view.kpis.fleetScore)}
            {view.kpis.fleetScore !== null && ` ${scoreBandLabel(view.kpis.fleetScore)}`}
          </span>{" "}
          · {view.kpis.submitted} assessments · {view.kpis.openFindings} open findings
        </p>
      )}

      <KpiCards kpis={view.kpis} period={view.period} cards={layout.cards} linked={layout.followUp} />

      {view.assessments.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No submitted assessments match these filters"
          action={
            <Button variant="outline" onClick={() => apply(DEFAULT_FILTER)}>
              Reset filters
            </Button>
          }
        >
          Range: {PRESET_LABELS[filter.preset].toLowerCase()}. Try a longer date range or fewer filters.
        </EmptyState>
      ) : (
        <Charts
          view={view}
          data={data}
          layout={layout}
          filter={filter}
          link={link}
          selectDimension={selectDimension}
          change={change}
        />
      )}
    </div>
  );
}

function summarise(rows: ScoreRow[], noun: string): string {
  const scored = rows.filter((r) => r.score !== null);
  if (scored.length === 0) return `No ${noun} scores.`;
  const low = scored[0];
  const high = scored[scored.length - 1];
  return `${scored.length} ${noun}s. Lowest ${low.name} ${low.score}%, highest ${high.name} ${high.score}%.`;
}

/**
 * The sections in role order:
 * - Admin: trend, Start Work failures, module tiles, then every breakdown.
 * - Auditor: follow-up lists, Start Work failures, module tiles, trend, vessel, self vs supervisory, top 10, findings.
 * - Supervisor: module tiles, trend, then every breakdown.
 */
function Charts({
  view,
  data,
  layout,
  filter,
  link,
  selectDimension,
  change,
}: {
  view: DashboardView;
  data: PreparedData;
  layout: DashboardLayout;
  filter: DashboardFilter;
  link: (extra?: DrillDown) => string;
  selectDimension: (key: DimensionKey) => (row: { id: string }) => void;
  change: (patch: Partial<DashboardFilter>) => void;
}) {
  const bucketName = { week: "week", month: "month", quarter: "quarter" }[view.bucket];
  const warnings = view.selfVsSupervisory.filter((r) => r.warning);
  const shownGaps = view.selfVsSupervisory.slice(0, 12);
  const totalFindings = view.findings.reduce((n, r) => n + r.total, 0);

  const trendCard = (
    <ChartCard
      className="lg:col-span-2"
      title="Score trend"
      description={`Average score per ${bucketName}. Dashed lines: 90% and 75%.`}
      href={link()}
      summary={`Average score per ${bucketName}: ${view.trend
        .filter((p) => p.score !== null)
        .map((p) => `${p.label} ${p.score}%`)
        .join(", ")}.`}
    >
      <TrendChart points={view.trend} />
    </ChartCard>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {layout.followUp && (
        <div className="lg:col-span-2">
          <FollowUpLists view={view} />
        </div>
      )}

      {layout.role === "ADMIN" && trendCard}

      {layout.startWork && (
        <StartWorkFailures
          data={data}
          assessments={view.assessments}
          failures={view.startWork}
          link={link}
          onVessel={(vesselId) => change({ vesselId })}
        />
      )}

      <ModuleTiles
        tiles={view.tiles}
        data={data}
        selectedModuleId={filter.moduleId}
        href={link()}
        // "All vessels" while the top bar has a vessel needs the explicit "all" value; otherwise unset follows the top bar.
        onVessel={(vesselId) => change({ tileVesselId: vesselId ?? (filter.vesselId ? ALL_VESSELS : undefined) })}
        onSelect={(moduleId) => change({ moduleId: filter.moduleId === moduleId ? undefined : moduleId })}
      />

      {layout.role !== "ADMIN" && trendCard}

      <ChartCard
        className={layout.fleetBreakdowns ? "lg:row-span-2" : undefined}
        title="Score by vessel"
        description="Lowest first. Red < 75%, amber 75–89%, green ≥ 90%. Tap a bar to filter."
        href={link()}
        summary={summarise(view.byVessel, "vessel")}
      >
        <ScoreBars rows={view.byVessel} onSelect={selectDimension("vesselId")} />
      </ChartCard>

      {layout.fleetBreakdowns && (
        <>
          <ChartCard title="Score by location" href={link()} summary={summarise(view.byLocation, "location")}>
            <ScoreBars rows={view.byLocation} onSelect={selectDimension("locationId")} labelWidth={90} />
          </ChartCard>

          <ChartCard title="Score by package" href={link()} summary={summarise(view.byPackage, "package")}>
            <ScoreBars rows={view.byPackage} onSelect={selectDimension("packageId")} labelWidth={100} />
          </ChartCard>

          <ChartCard
            className="lg:col-span-2"
            title="Contractor ranking"
            description="By the submitter's company, best first. Tap a bar to see its assessments."
            href={link()}
            summary={`Best: ${view.contractors[0]?.name ?? "none"} ${view.contractors[0]?.score ?? ""}%.`}
          >
            <ContractorBars rows={view.contractors} link={link} />
          </ChartCard>
        </>
      )}

      <ChartCard
        className="lg:col-span-2"
        title="Self vs supervisory, per vessel"
        description={`Vessels with both kinds of assessment, biggest gap first${
          view.selfVsSupervisory.length > shownGaps.length ? ` (top ${shownGaps.length} of ${view.selfVsSupervisory.length})` : ""
        }. ⚠ = self ${GAP_WARNING_POINTS}+ points above supervisory.`}
        href={link()}
        summary={
          warnings.length > 0
            ? `${warnings.length} vessels where self-assessments score ${GAP_WARNING_POINTS} or more points above supervisory audits: ${warnings
                .map((w) => `${w.name} (${w.self}% vs ${w.supervisory}%)`)
                .join(", ")}.`
            : "No big gaps between self and supervisory scores."
        }
      >
        {warnings.length > 0 && (
          <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Crews rate themselves much higher than supervisors do on{" "}
              {warnings.map((w, i) => (
                <span key={w.id}>
                  {i > 0 && (i === warnings.length - 1 ? " and " : ", ")}
                  <span className="font-medium">{w.name}</span> ({w.self}% vs {w.supervisory}%)
                </span>
              ))}
              . Worth a closer look.
            </span>
          </p>
        )}
        <SelfVsSupervisoryChart rows={shownGaps} onSelect={selectDimension("vesselId")} />
      </ChartCard>

      <ChartCard
        title="Top 10 Non-Compliant questions"
        description="Most frequent No answers. Tap one to see those assessments."
        href={link()}
        summary={view.topNonCompliant.map((q, i) => `${i + 1}. ${q.text} (${q.count})`).join(" ")}
      >
        <TopQuestions view={view} link={link} />
      </ChartCard>

      <ChartCard
        title="Findings by status and risk"
        description={`${totalFindings} findings raised on these assessments.`}
        href={link()}
        summary={view.findings.map((r) => `${r.status}: ${r.total} (High ${r.HIGH}, Medium ${r.MEDIUM}, Low ${r.LOW})`).join(". ")}
      >
        <FindingsChart rows={view.findings} />
      </ChartCard>
    </div>
  );
}

/** Contractor bars open the filtered list (there is no contractor filter on the dashboard itself). */
function ContractorBars({ rows, link }: { rows: ScoreRow[]; link: (extra?: DrillDown) => string }) {
  const router = useRouter();
  return <ScoreBars rows={rows} labelWidth={150} onSelect={(row) => router.push(link({ company: row.id }))} />;
}

function TopQuestions({ view, link }: { view: DashboardView; link: (extra?: DrillDown) => string }) {
  const max = view.topNonCompliant[0]?.count ?? 1;
  if (view.topNonCompliant.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No questions were answered No.</p>;
  }
  return (
    <ol className="divide-y">
      {view.topNonCompliant.map((q, index) => (
        <li key={q.questionId}>
          <Link href={link({ questionId: q.questionId })} className="flex items-center gap-3 rounded-lg py-2.5 hover:bg-muted">
            <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-sm leading-snug">{q.text}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {q.moduleName}
                {q.critical && (
                  <Badge className="bg-destructive/10 text-destructive">
                    <ShieldAlert /> Critical
                  </Badge>
                )}
              </span>
              <span className="block h-1.5 rounded-full bg-muted">
                <span className="block h-full rounded-full bg-red-500" style={{ width: `${(q.count / max) * 100}%` }} />
              </span>
            </span>
            <span className="shrink-0 text-lg font-semibold tabular-nums text-red-700">{q.count}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ol>
  );
}
