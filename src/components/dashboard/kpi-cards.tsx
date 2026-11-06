import { ArrowDownRight, ArrowUpRight, ClipboardCheck, ClipboardX, Clock, Gauge, OctagonX, Sparkles } from "lucide-react";
import { formatScore, scoreTone } from "@/components/assess/answer-style";
import type { Kpis, Period } from "@/lib/services/dashboard";
import { periodDays } from "@/lib/services/dashboard";
import { scoreBandLabel } from "@/lib/services/scoring";
import { cn } from "@/lib/utils";

function Card({
  label,
  icon: Icon,
  value,
  valueClass,
  note,
  tone,
}: {
  label: string;
  icon: React.ElementType;
  value: React.ReactNode;
  valueClass?: string;
  note?: React.ReactNode;
  tone?: "alert";
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl border bg-card p-4", tone === "alert" && "border-red-300 bg-red-50")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className={cn("text-3xl font-bold tabular-nums", valueClass)}>{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Headline numbers. The fleet score shows the change vs the previous period of the same length. */
export function KpiCards({ kpis, period }: { kpis: Kpis; period: Period }) {
  const days = periodDays(period);
  const change =
    kpis.change === null ? (
      kpis.previousScore === null ? (
        "No earlier data to compare"
      ) : (
        "No score this period"
      )
    ) : kpis.change === 0 ? (
      `No change vs previous ${days} days`
    ) : (
      <span className={cn("inline-flex items-center gap-0.5 font-medium", kpis.change > 0 ? "text-emerald-700" : "text-red-700")}>
        {kpis.change > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
        {kpis.change > 0 ? "+" : "−"}
        {Math.abs(kpis.change)} pts vs previous {days} days ({formatScore(kpis.previousScore)})
      </span>
    );

  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div className="col-span-2 md:col-span-1">
        <Card label="Fleet assurance score" icon={Gauge} value={
            <>
              {formatScore(kpis.fleetScore)}
              {kpis.fleetScore !== null && <span className="ml-2 text-base font-medium">{scoreBandLabel(kpis.fleetScore)}</span>}
            </>
          }
          valueClass={scoreTone(kpis.fleetScore)} note={change} />
      </div>
      <Card
        label="Assessments submitted"
        icon={ClipboardCheck}
        value={String(kpis.submitted)}
        note={`${kpis.previousSubmitted} in the previous ${days} days`}
      />
      <Card label="Open findings" icon={ClipboardX} value={String(kpis.openFindings)} note="On these assessments, not closed" />
      <Card
        label="Overdue findings"
        icon={Clock}
        value={String(kpis.overdueFindings)}
        valueClass={kpis.overdueFindings > 0 ? "text-red-700" : undefined}
        tone={kpis.overdueFindings > 0 ? "alert" : undefined}
        note="An action is past its target date"
      />
      <Card label="Good Practice" icon={Sparkles} value={String(kpis.goodPractice)} valueClass="text-emerald-700" note="Positive interventions" />
      <Card
        label="Start Work STOPs"
        icon={OctagonX}
        value={String(kpis.stopChecks)}
        valueClass={kpis.stopChecks > 0 ? "text-red-700" : undefined}
        note="Start Work Checks with a No"
      />
    </section>
  );
}
