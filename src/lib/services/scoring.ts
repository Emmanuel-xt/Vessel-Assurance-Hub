// Scoring rules (CLAUDE.md §8). Pure functions, unit-tested.

import type { Answer, ID } from "@/lib/types";

/** Points per answer. N/A is excluded from both points and maximum. */
export const ANSWER_POINTS: Record<Answer, number | null> = {
  YES: 1,
  CONCERN: 0.5,
  NO: 0,
  NA: null,
};

export interface ScorableAnswer {
  answer: Answer;
  weight: number;
}

/**
 * Score = Σ(points × weight) / Σ(weight of non-N/A answers) × 100, rounded to a whole percent.
 * Returns null when nothing is scorable (no answers, or all N/A).
 */
export function calculateScore(answers: ScorableAnswer[]): number | null {
  let earned = 0;
  let max = 0;
  for (const { answer, weight } of answers) {
    const points = ANSWER_POINTS[answer];
    if (points === null) continue;
    earned += points * weight;
    max += weight;
  }
  if (max === 0) return null;
  return Math.round((earned / max) * 100);
}

export interface ModuleScorableAnswer extends ScorableAnswer {
  moduleId: ID;
}

export interface AssessmentScores {
  /** All answers pooled with the same formula (not an average of module scores). */
  overall: number | null;
  byModule: Record<ID, number | null>;
}

/** Overall score plus one score per module. Modules listed in `moduleIds` but unanswered score null. */
export function calculateAssessmentScores(answers: ModuleScorableAnswer[], moduleIds: ID[] = []): AssessmentScores {
  const grouped = new Map<ID, ScorableAnswer[]>(moduleIds.map((id) => [id, []]));
  for (const answer of answers) {
    const group = grouped.get(answer.moduleId) ?? [];
    group.push(answer);
    grouped.set(answer.moduleId, group);
  }

  const byModule: Record<ID, number | null> = {};
  for (const [moduleId, group] of grouped) {
    byModule[moduleId] = calculateScore(group);
  }

  return { overall: calculateScore(answers), byModule };
}

/** Score colour bands used everywhere: green from 90%, amber from 75%, red below (owner decision, Stage 12). */
export const SCORE_BANDS = { green: 90, amber: 75 } as const;

export type ScoreBand = "green" | "amber" | "red" | "none";

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score === null || score === undefined) return "none";
  if (score >= SCORE_BANDS.green) return "green";
  if (score >= SCORE_BANDS.amber) return "amber";
  return "red";
}

/** Words for the bands, so a score never relies on colour alone (accessibility). */
export const SCORE_BAND_LABELS: Record<ScoreBand, string> = { green: "Good", amber: "Fair", red: "Poor", none: "No score" };

export function scoreBandLabel(score: number | null | undefined): string {
  return SCORE_BAND_LABELS[scoreBand(score)];
}
