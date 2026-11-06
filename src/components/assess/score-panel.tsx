import type { FormSection } from "@/lib/services/assessments";
import type { AssessmentScores } from "@/lib/services/scoring";
import { ScoreValue } from "./score-value";

/** Overall score plus, for multi-module assessments, one row per module. */
export function ScorePanel({
  scores,
  sections,
  label = "Score",
}: {
  scores: AssessmentScores;
  /** Only the module names are used. */
  sections: Pick<FormSection, "module">[];
  label?: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <ScoreValue score={scores.overall} className="text-4xl font-bold" />
      </div>
      {scores.overall === null && (
        <p className="text-xs text-muted-foreground">Every answer is N/A, so there is nothing to score.</p>
      )}
      {sections.length > 1 && (
        <ul className="divide-y border-t text-sm">
          {sections.map((section) => {
            const score = scores.byModule[section.module.id] ?? null;
            return (
              <li key={section.module.id} className="flex items-center justify-between gap-3 py-2">
                <span>{section.module.name}</span>
                <ScoreValue score={score} layout="inline" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
