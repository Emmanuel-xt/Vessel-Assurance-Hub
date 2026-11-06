import { scoreBand } from "@/lib/services/scoring";
import type { Answer } from "@/lib/types";

/** Selected-state colours for each answer, also used for answer chips in summaries. */
export const ANSWER_STYLES: Record<Answer, string> = {
  YES: "border-emerald-700 bg-emerald-700 text-white",
  CONCERN: "border-amber-400 bg-amber-400 text-amber-950",
  NO: "border-red-600 bg-red-600 text-white",
  NA: "border-slate-500 bg-slate-500 text-white",
};

const TONE = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
  none: "text-muted-foreground",
} as const;

/** Text colour for a score: green from 90%, amber from 75%, red below (`scoreBand`). */
export function scoreTone(score: number | null): string {
  return TONE[scoreBand(score)];
}

export const formatScore = (score: number | null) => (score === null ? "n/a" : `${score}%`);
