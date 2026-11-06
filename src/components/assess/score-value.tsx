import { scoreBandLabel } from "@/lib/services/scoring";
import { cn } from "@/lib/utils";
import { formatScore, scoreTone } from "./answer-style";

/**
 * A score with its band in words ("86% Fair"), coloured by band. The word means the status never relies on
 * colour alone. `stack` puts the word under the number (big scores); `inline` puts it after.
 */
export function ScoreValue({
  score,
  className,
  layout = "stack",
}: {
  score: number | null;
  /** Classes for the number (size, weight). */
  className?: string;
  layout?: "stack" | "inline";
}) {
  const tone = scoreTone(score);
  return (
    <span
      className={cn("inline-flex shrink-0", layout === "stack" ? "flex-col items-end leading-none" : "items-baseline gap-1.5")}
      aria-label={score === null ? "No score" : `Score ${formatScore(score)}, ${scoreBandLabel(score)}`}
      role="img"
    >
      <span className={cn("font-semibold tabular-nums", tone, className)} aria-hidden>
        {formatScore(score)}
      </span>
      {score !== null && (
        <span className={cn("text-xs font-medium", layout === "stack" && "mt-1", tone)} aria-hidden>
          {scoreBandLabel(score)}
        </span>
      )}
    </span>
  );
}
