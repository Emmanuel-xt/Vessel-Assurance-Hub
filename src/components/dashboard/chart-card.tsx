import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ScoreBand } from "@/lib/services/scoring";
import { cn } from "@/lib/utils";

/** Bar colours for score bands (red < 75%, amber 75–89%, green ≥ 90%). */
export const BAND_FILL: Record<ScoreBand, string> = {
  red: "#dc2626",
  amber: "#f59e0b",
  green: "#16a34a",
  none: "#94a3b8",
};

export const CHART_COLORS = {
  self: "#0d9488",
  supervisory: "#1e3a8a",
  line: "#0f766e",
  grid: "#e2e8f0",
  axis: "#64748b",
  HIGH: "#dc2626",
  MEDIUM: "#f59e0b",
  LOW: "#38bdf8",
} as const;

/** Card around one chart: title, optional note, "View assessments" link and a screen-reader summary. */
export function ChartCard({
  title,
  description,
  href,
  summary,
  className,
  children,
}: {
  title: string;
  description?: string;
  /** Filtered All assessments list. */
  href: string;
  /** One sentence describing the chart for screen readers. */
  summary: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={cn("flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <Link
          href={href}
          className="-mx-2 inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-teal hover:bg-muted"
        >
          View assessments <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="min-w-0 flex-1" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

export function NoData({ children = "No data for these filters." }: { children?: React.ReactNode }) {
  return <p className="flex h-32 items-center justify-center text-sm text-muted-foreground">{children}</p>;
}
