"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScoreValue } from "@/components/assess/score-value";
import { NativeSelect } from "@/components/forms/native-select";
import { ModuleIcon } from "@/components/hub/module-icon";
import { Label } from "@/components/ui/label";
import { type ModuleTile, type ModuleTiles as Tiles, type PreparedData } from "@/lib/services/dashboard";
import type { ScoreBand } from "@/lib/services/scoring";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAND_BORDER: Record<ScoreBand, string> = {
  red: "border-l-red-600",
  amber: "border-l-amber-500",
  green: "border-l-emerald-600",
  none: "border-l-slate-300",
};

const FAILURE_TEXT: Record<ScoreBand, string> = {
  red: "text-red-700",
  amber: "text-amber-700",
  green: "text-emerald-700",
  none: "text-muted-foreground",
};

/**
 * Score by module as tiles, with their own vessel filter. Tapping a tile filters the whole dashboard by that module.
 */
export function ModuleTiles({
  tiles,
  data,
  selectedModuleId,
  href,
  onVessel,
  onSelect,
}: {
  tiles: Tiles;
  data: PreparedData;
  selectedModuleId?: ID;
  href: string;
  /** null = every vessel. */
  onVessel: (vesselId: ID | null) => void;
  onSelect: (moduleId: ID) => void;
}) {
  const vessels = [...new Set(data.assessments.map((a) => a.vesselId))]
    .map((id) => ({ id, name: data.names.vessel.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const vesselName = tiles.vesselId ? (data.names.vessel.get(tiles.vesselId) ?? "this vessel") : null;

  return (
    <section aria-labelledby="module-tiles-title" className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="module-tiles-title" className="font-semibold">
            Score by module
          </h2>
          <p className="text-xs text-muted-foreground">
            {vesselName ? `${vesselName} only. ` : "All vessels. "}Lowest first. Full Vessel assessments count for each module. Tap a
            tile to filter the dashboard.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 space-y-1 sm:w-56 sm:flex-none">
            <Label htmlFor="tile-vessel" className="text-xs">
              Vessel (tiles only)
            </Label>
            <NativeSelect
              id="tile-vessel"
              value={tiles.vesselId ?? ""}
              onChange={(e) => onVessel(e.target.value || null)}
            >
              <option value="">All vessels</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Link
            href={href}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-teal hover:bg-muted"
          >
            View assessments <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      <TileGroup title="LOD 1 Assurance" tiles={tiles.assurance} without={tiles.withoutData.assurance} selected={selectedModuleId} onSelect={onSelect} />
      <TileGroup title="Start Work tasks" tiles={tiles.startWork} without={tiles.withoutData.startWork} selected={selectedModuleId} onSelect={onSelect} />
    </section>
  );
}

function TileGroup({
  title,
  tiles,
  without,
  selected,
  onSelect,
}: {
  title: string;
  tiles: ModuleTile[];
  without: number;
  selected?: ID;
  onSelect: (moduleId: ID) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {tiles.length === 0 ? (
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No assessments for these filters.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(tile.id)}
                aria-pressed={selected === tile.id}
                className={cn(
                  "flex h-full min-h-24 w-full flex-col gap-2 rounded-xl border border-l-4 bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  BAND_BORDER[tile.band],
                  selected === tile.id && "bg-teal/5 ring-2 ring-teal",
                )}
              >
                <span className="flex items-start gap-2">
                  <ModuleIcon moduleId={tile.id} className="mt-0.5 size-4 shrink-0 text-navy" />
                  <span className="min-w-0 flex-1 text-sm leading-snug font-medium">{tile.name}</span>
                </span>
                <span className="mt-auto flex items-end justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {tile.count} {tile.count === 1 ? "assessment" : "assessments"}
                    {tile.failureRate !== null && (
                      <span className={cn("block font-medium", FAILURE_TEXT[tile.failureBand])}>{tile.failureRate}% stopped</span>
                    )}
                  </span>
                  <ScoreValue score={tile.score} className="text-xl" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {without > 0 && (
        <p className="text-xs text-muted-foreground">
          {without} more {without === 1 ? "module has" : "modules have"} no assessments for these filters.
        </p>
      )}
    </div>
  );
}
