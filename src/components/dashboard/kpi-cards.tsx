import { ArrowDownRight, ArrowUpRight, ChevronDown, ClipboardCheck, ClipboardX, Clock, Gauge, OctagonX, Sparkles } from "lucide-react";
import { formatScore, scoreTone } from "@/components/assess/answer-style";
import type { KpiKey, Kpis, Period } from "@/lib/services/dashboard";
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
  href,
}: {
  label: string;
  icon: React.ElementType;
  value: React.ReactNode;
  valueClass?: string;
  note?: React.ReactNode;
  tone?: "alert" | "good";
  /** Jumps to the list behind the number (Auditor follow-up). */
  href?: string;
}) {
  const className = cn(
    "flex h-full flex-col gap-1 rounded-2xl border bg-card p-4",
    tone === "alert" && "border-red-300 bg-red-50",
    tone === "good" && "border-emerald-200 bg-emerald-50/60",
    href && "transition-colors hover:border-teal focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
  );
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className={cn("text-3xl font-bold tabular-nums", valueClass)}>{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {href && (
        <p className="mt-auto flex items-center gap-1 pt-1 text-xs font-medium text-teal">
          See the list <ChevronDown className="size-3.5" aria-hidden />
        </p>
      )}
    </>
  );
  return href ? (
    <a href={href} className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * Headline numbers, chosen per role (`dashboardLayoutFor`). The fleet score shows the change vs the previous period of
 * the same length. With `linked`, the follow-up cards jump to their lists.
 */
export function KpiCards({ kpis, period, cards, linked = false }: { kpis: Kpis; period: Period; cards: KpiKey[]; linked?: boolean }) {
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

  const render: Record<KpiKey, React.ReactNode> = {
    fleetScore: (
      <Card
        label="Fleet assurance score"
        icon={Gauge}
        value={
          <>
            {formatScore(kpis.fleetScore)}
            {kpis.fleetScore !== null && <span className="ml-2 text-base font-medium">{scoreBandLabel(kpis.fleetScore)}</span>}
          </>
        }
        valueClass={scoreTone(kpis.fleetScore)}
        note={change}
      />
    ),
    submitted: (
      <Card
        label="Assessments submitted"
        icon={ClipboardCheck}
        value={String(kpis.submitted)}
        note={`${kpis.previousSubmitted} in the previous ${days} days`}
      />
    ),
    openFindings: <Card label="Open findings" icon={ClipboardX} value={String(kpis.openFindings)} note="On these assessments, not closed" />,
    overdueFindings: (
      <Card
        label="Overdue findings"
        icon={Clock}
        value={String(kpis.overdueFindings)}
        valueClass={kpis.overdueFindings > 0 ? "text-red-700" : undefined}
        tone={kpis.overdueFindings > 0 ? "alert" : undefined}
        note="An action is past its target date"
        href={linked ? "#follow-overdue" : undefined}
      />
    ),
    stopChecks: (
      <Card
        label="Start Work STOPs"
        icon={OctagonX}
        value={String(kpis.stopChecks)}
        valueClass={kpis.stopChecks > 0 ? "text-red-700" : undefined}
        tone={linked && kpis.stopChecks > 0 ? "alert" : undefined}
        note="Start Work Checks with a No"
        href={linked ? "#follow-stops" : undefined}
      />
    ),
    goodPractice: (
      <Card
        label="Good Practice"
        icon={Sparkles}
        value={String(kpis.goodPractice)}
        valueClass="text-emerald-700"
        tone={linked ? "good" : undefined}
        note="Positive interventions"
        href={linked ? "#follow-good" : undefined}
      />
    ),
  };

  return (
    <section
      aria-label="Key figures"
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-3", cards.length === 6 && "xl:grid-cols-6")}
    >
      {cards.map((key, index) => (
        // The first card spans the row on phones (2-column grid).
        <div key={key} className={index === 0 ? "col-span-2 md:col-span-1" : undefined}>
          {render[key]}
        </div>
      ))}
    </section>
  );
}
