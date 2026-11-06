import { describe, expect, it } from "vitest";
import { calculateAssessmentScores, calculateScore, scoreBandLabel } from "@/lib/services/scoring";

describe("calculateScore: CLAUDE.md §8 cases", () => {
  it("all compliant scores 100%", () => {
    expect(calculateScore([{ answer: "YES", weight: 1 }, { answer: "YES", weight: 2 }, { answer: "YES", weight: 5 }])).toBe(100);
  });

  it("mixed answers: Yes 1, Concern 0.5, No 0", () => {
    // (1 + 0.5 + 0) / 3 = 50%
    expect(calculateScore([{ answer: "YES", weight: 1 }, { answer: "CONCERN", weight: 1 }, { answer: "NO", weight: 1 }])).toBe(50);
  });

  it("all N/A has no score (null), not 0% or 100%", () => {
    expect(calculateScore([{ answer: "NA", weight: 1 }, { answer: "NA", weight: 3 }])).toBeNull();
  });

  it("weighted: a weight-2 No outweighs a weight-1 Yes", () => {
    // (1×1 + 0×2) / (1 + 2) = 33.3% → 33
    expect(calculateScore([{ answer: "YES", weight: 1 }, { answer: "NO", weight: 2 }])).toBe(33);
    // (0.5×4 + 1×1) / 5 = 60%, with N/A excluded from the maximum
    expect(
      calculateScore([{ answer: "CONCERN", weight: 4 }, { answer: "YES", weight: 1 }, { answer: "NA", weight: 5 }]),
    ).toBe(60);
  });

  it("rounds to a whole percent", () => {
    // 2 / 3 = 66.67% → 67
    expect(calculateScore([{ answer: "YES", weight: 1 }, { answer: "YES", weight: 1 }, { answer: "NO", weight: 1 }])).toBe(67);
  });
});

describe("calculateScore", () => {
  it("scores Yes = 1, Concern = 0.5, No = 0", () => {
    expect(
      calculateScore([
        { answer: "YES", weight: 1 },
        { answer: "CONCERN", weight: 1 },
        { answer: "NO", weight: 1 },
        { answer: "YES", weight: 1 },
      ]),
    ).toBe(63); // 2.5 / 4 = 62.5% → 63
  });

  it("excludes N/A from points and maximum", () => {
    expect(
      calculateScore([
        { answer: "YES", weight: 1 },
        { answer: "NA", weight: 5 },
      ]),
    ).toBe(100);
  });

  it("weights answers by question weight", () => {
    expect(
      calculateScore([
        { answer: "YES", weight: 1 },
        { answer: "NO", weight: 3 },
      ]),
    ).toBe(25);
  });

  it("returns null when nothing is scorable", () => {
    expect(calculateScore([])).toBeNull();
    expect(calculateScore([{ answer: "NA", weight: 1 }])).toBeNull();
  });
});

describe("calculateAssessmentScores", () => {
  it("pools all answers for the overall score and scores each module separately", () => {
    const scores = calculateAssessmentScores(
      [
        { moduleId: "m1", answer: "YES", weight: 1 },
        { moduleId: "m1", answer: "YES", weight: 1 },
        { moduleId: "m1", answer: "YES", weight: 1 },
        { moduleId: "m2", answer: "NO", weight: 1 },
      ],
      ["m1", "m2", "m3"],
    );
    expect(scores.byModule).toEqual({ m1: 100, m2: 0, m3: null });
    expect(scores.overall).toBe(75); // pooled 3/4, not the average of 100 and 0
  });
});

describe("score band labels", () => {
  it("names each band so status is not shown by colour alone", () => {
    expect([95, 90, 89, 75, 74, 0].map(scoreBandLabel)).toEqual(["Good", "Good", "Fair", "Fair", "Poor", "Poor"]);
    expect(scoreBandLabel(null)).toBe("No score");
  });
});
