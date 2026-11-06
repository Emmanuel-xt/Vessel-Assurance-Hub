"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import { RISK_LABELS } from "@/lib/services/findings";
import type { FindingsByStatusRow, ScoreRow, SelfVsSupervisoryRow, TrendPoint } from "@/lib/services/dashboard";
import { SCORE_BANDS } from "@/lib/services/scoring";
import { BAND_FILL, CHART_COLORS, NoData } from "./chart-card";

const AXIS = { fontSize: 12, fill: CHART_COLORS.axis };
const PERCENT_TICKS = [0, 25, 50, 75, 100];
// Horizontal bars leave little width for the axis on phones: 0 / 50 / 100 never collide.
const BAR_TICKS = [0, 50, 100];
const truncate = (text: string, max = 16) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function TooltipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">{children}</div>;
}

// ---------- Trend ----------

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.every((p) => p.count === 0)) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis domain={[0, 100]} ticks={PERCENT_TICKS} tick={AXIS} tickLine={false} axisLine={false} unit="%" width={48} />
        <ReferenceLine y={SCORE_BANDS.green} stroke={BAND_FILL.green} strokeDasharray="4 4" />
        <ReferenceLine y={SCORE_BANDS.amber} stroke={BAND_FILL.amber} strokeDasharray="4 4" />
        <Tooltip
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as TrendPoint | undefined;
            if (!active || !point) return null;
            return (
              <TooltipBox>
                <p className="font-medium">{point.label}</p>
                <p>{point.score === null ? "No assessments" : `${point.score}% average · ${point.count} assessments`}</p>
              </TooltipBox>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={CHART_COLORS.line}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------- Score bars (vessel, location, module, package, contractor) ----------

/**
 * Horizontal bars, one row per item in the given order, coloured by score band.
 * Height grows with the number of rows so long lists stay readable on a phone.
 */
export function ScoreBars({
  rows,
  onSelect,
  labelWidth = 116,
}: {
  rows: ScoreRow[];
  /** Tapping a bar (e.g. applies that filter). */
  onSelect?: (row: ScoreRow) => void;
  labelWidth?: number;
}) {
  const scored = rows.filter((r) => r.score !== null);
  if (scored.length === 0) return <NoData />;
  const height = Math.max(120, scored.length * 30 + 32);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={scored} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={6}>
        <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} ticks={BAR_TICKS} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(name: string) => truncate(name, Math.floor(labelWidth / 7))}
        />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as ScoreRow | undefined;
            if (!active || !row) return null;
            return (
              <TooltipBox>
                <p className="font-medium">{row.name}</p>
                <p>
                  {row.score}% · {row.count} assessment{row.count === 1 ? "" : "s"}
                </p>
                {onSelect && <p className="text-muted-foreground">Tap to filter</p>}
              </TooltipBox>
            );
          }}
        />
        <Bar
          dataKey="score"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          label={{ position: "right", fontSize: 12, fill: CHART_COLORS.axis, formatter: (v: unknown) => `${v}%` }}
          shape={(props: BarShapeProps) => (
            <Rectangle {...props} fill={BAND_FILL[(props.payload as ScoreRow).band]} style={onSelect ? { cursor: "pointer" } : undefined} />
          )}
          onClick={onSelect ? (item) => onSelect(item.payload as ScoreRow) : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Self vs supervisory ----------

export function SelfVsSupervisoryChart({
  rows,
  onSelect,
}: {
  rows: SelfVsSupervisoryRow[];
  onSelect?: (row: SelfVsSupervisoryRow) => void;
}) {
  if (rows.length === 0) return <NoData>No vessel has both self and supervisory assessments in this selection.</NoData>;
  const height = Math.max(140, rows.length * 44 + 48);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barGap={1} barCategoryGap={8}>
        <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} ticks={BAR_TICKS} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
        <YAxis
          type="category"
          dataKey="name"
          width={124}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(name: string) => {
            const row = rows.find((r) => r.name === name);
            return `${row?.warning ? "⚠ " : ""}${truncate(name, 15)}`;
          }}
        />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as SelfVsSupervisoryRow | undefined;
            if (!active || !row) return null;
            return (
              <TooltipBox>
                <p className="font-medium">{row.name}</p>
                <p>
                  Self {row.self}% ({row.selfCount}) · Supervisory {row.supervisory}% ({row.supervisoryCount})
                </p>
                <p className={row.warning ? "font-medium text-red-700" : "text-muted-foreground"}>
                  Gap {row.gap > 0 ? "+" : ""}
                  {row.gap} pts{row.warning ? " — warning" : ""}
                </p>
              </TooltipBox>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          name="Self"
          dataKey="self"
          fill={CHART_COLORS.self}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          style={onSelect ? { cursor: "pointer" } : undefined}
          onClick={onSelect ? (item) => onSelect(item.payload as SelfVsSupervisoryRow) : undefined}
        />
        <Bar
          name="Supervisory"
          dataKey="supervisory"
          fill={CHART_COLORS.supervisory}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          style={onSelect ? { cursor: "pointer" } : undefined}
          onClick={onSelect ? (item) => onSelect(item.payload as SelfVsSupervisoryRow) : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Findings by status and risk ----------

const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In progress", CLOSED: "Closed" } as const;

export function FindingsChart({ rows }: { rows: FindingsByStatusRow[] }) {
  if (rows.every((r) => r.total === 0)) return <NoData>No findings on these assessments.</NoData>;
  const data = rows.map((r) => ({ ...r, label: STATUS_LABEL[r.status] }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as (FindingsByStatusRow & { label: string }) | undefined;
            if (!active || !row) return null;
            return (
              <TooltipBox>
                <p className="font-medium">
                  {row.label}: {row.total}
                </p>
                <p>
                  High {row.HIGH} · Medium {row.MEDIUM} · Low {row.LOW}
                </p>
              </TooltipBox>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {(["HIGH", "MEDIUM", "LOW"] as const).map((risk, index) => (
          <Bar
            key={risk}
            name={RISK_LABELS[risk]}
            dataKey={risk}
            stackId="risk"
            fill={CHART_COLORS[risk]}
            isAnimationActive={false}
            radius={index === 2 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
