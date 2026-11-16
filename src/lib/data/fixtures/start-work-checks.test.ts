import { describe, expect, it } from "vitest";
import { parseGuidance } from "@/lib/guidance";
import { MODULES } from "./modules";
import { QUESTIONS } from "./questions";
import { RISK_CATEGORIES } from "./lookups";
import { START_WORK_BANK } from "./start-work-checks";

/** Items per task on the owner's sheets (Bunkering: item 6 repeated item 3 and was dropped). */
const SHEET_ITEMS: Record<string, number> = {
  "mod-deck-work": 20,
  "mod-bunkering": 18,
  "mod-personnel-transfer": 12,
  "mod-mechanical-lifting": 8,
  "mod-working-at-height": 8,
  "mod-hot-work": 6,
  "mod-energy-isolation": 6,
  "mod-de-isolation": 4,
  "mod-confined-space-entry": 7,
  "mod-energised-electrical": 8,
  "mod-man-riding": 7,
  "mod-work-near-water": 6,
  "mod-mobile-equipment": 6,
  "mod-excavation": 9,
  "mod-decommissioning": 6,
  "mod-rig-floor-tubular": 7,
  "mod-driving": 8,
};
const MARINE = ["mod-deck-work", "mod-bunkering", "mod-personnel-transfer"];

describe("the owner's Start Work Check sheets", () => {
  const tasks = MODULES.filter((m) => m.category === "START_WORK");

  it("are the 17 Start Work tasks, each with every item from its sheet", () => {
    expect(tasks.map((m) => m.id).sort()).toEqual(Object.keys(SHEET_ITEMS).sort());
    expect(Object.keys(START_WORK_BANK).sort()).toEqual(Object.keys(SHEET_ITEMS).sort());
    for (const [moduleId, count] of Object.entries(SHEET_ITEMS)) {
      expect(QUESTIONS.filter((q) => q.moduleId === moduleId), moduleId).toHaveLength(count);
    }
    expect(MODULES.filter((m) => m.category === "ASSURANCE")).toHaveLength(10);
  });

  it("mark 1–3 key barriers per task as critical controls (weight 2)", () => {
    for (const moduleId of Object.keys(SHEET_ITEMS)) {
      const questions = QUESTIONS.filter((q) => q.moduleId === moduleId);
      const critical = questions.filter((q) => q.criticalControl);
      expect(critical.length, moduleId).toBeGreaterThanOrEqual(1);
      expect(critical.length, moduleId).toBeLessThanOrEqual(3);
      for (const q of questions) expect(q.weight).toBe(q.criticalControl ? 2 : 1);
    }
  });

  it("have no repeated wording, known risk categories and no evidence-photo rule", () => {
    const riskIds = new Set(RISK_CATEGORIES.map((r) => r.id));
    for (const moduleId of Object.keys(SHEET_ITEMS)) {
      const texts = QUESTIONS.filter((q) => q.moduleId === moduleId).map((q) => q.text.toLowerCase());
      expect(new Set(texts).size, moduleId).toBe(texts.length);
    }
    for (const q of QUESTIONS.filter((x) => x.moduleId in SHEET_ITEMS)) {
      expect(riskIds.has(q.riskCategoryId), q.id).toBe(true);
      expect(q.evidenceRequired).toBe(false);
      expect(q.text.length).toBeLessThanOrEqual(300); // the question form's limit
    }
  });

  it("carry the IOGP 'How to (examples)' guidance on every IOGP item, and none on the marine sheets", () => {
    for (const q of QUESTIONS.filter((x) => x.moduleId in SHEET_ITEMS)) {
      if (MARINE.includes(q.moduleId)) expect(q.guidance, q.id).toBe("");
      else expect(parseGuidance(q.guidance).length, q.id).toBeGreaterThan(0);
      expect(q.guidance.length).toBeLessThanOrEqual(2000);
    }
  });

  it("copy no client branding or document numbers into the app", () => {
    const all = JSON.stringify({ START_WORK_BANK, MODULES });
    expect(all).not.toMatch(/\bshell\b|bonga north|BNO-|proprietary information|document no/i);
  });
});

describe("parseGuidance", () => {
  it("reads bullets, sub-bullets and notes", () => {
    expect(parseGuidance("Gas test done\n- at all openings\nNote: follow company rules\n\n")).toEqual([
      { kind: "bullet", text: "Gas test done" },
      { kind: "sub", text: "at all openings" },
      { kind: "note", text: "follow company rules" },
    ]);
  });
});
