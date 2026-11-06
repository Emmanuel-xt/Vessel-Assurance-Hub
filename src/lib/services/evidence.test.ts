import { describe, expect, it } from "vitest";
import { evidenceNeeded, isMissingEvidence, photoSlotsLeft } from "./evidence";

const required = { evidenceRequired: true };
const optional = { evidenceRequired: false };

describe("evidenceNeeded", () => {
  it("needs a photo only for No and Concern on evidence-required questions", () => {
    expect(evidenceNeeded(required, "NO")).toBe(true);
    expect(evidenceNeeded(required, "CONCERN")).toBe(true);
    expect(evidenceNeeded(required, "YES")).toBe(false);
    expect(evidenceNeeded(required, "NA")).toBe(false);
    expect(evidenceNeeded(required, null)).toBe(false);
    expect(evidenceNeeded(optional, "NO")).toBe(false);
  });
});

describe("isMissingEvidence", () => {
  it("is satisfied by one photo", () => {
    expect(isMissingEvidence(required, "NO", [])).toBe(true);
    expect(isMissingEvidence(required, "NO", undefined)).toBe(true);
    expect(isMissingEvidence(required, "NO", ["p1"])).toBe(false);
  });
});

describe("photoSlotsLeft", () => {
  it("counts photos being uploaded and never goes below zero", () => {
    expect(photoSlotsLeft(0)).toBe(5);
    expect(photoSlotsLeft(3, 1)).toBe(1);
    expect(photoSlotsLeft(5, 2)).toBe(0);
  });
});
