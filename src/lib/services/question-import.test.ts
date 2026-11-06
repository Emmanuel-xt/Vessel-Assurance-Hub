import { beforeEach, describe, expect, it } from "vitest";
import { mockRepositories as repo } from "@/lib/data/mock";
import { forgetMemoryState } from "@/lib/data/mock/store";
import { setMockDelay } from "@/lib/data/mock/utils";
import type { Principal } from "@/lib/services/permissions";
import {
  buildTemplateCsv,
  importQuestions,
  parseCsv,
  toCsv,
  validateImport,
  type ImportContext,
} from "@/lib/services/question-import";

const admin: Principal = { id: "usr-admin", role: "ADMIN", status: "ACTIVE" };
const HEADER = "module,text,riskCategory,weight,evidenceRequired,vesselTypes,auditTypes";

async function context(): Promise<ImportContext> {
  const [modules, riskCategories, vesselTypes, auditTypes, questions] = await Promise.all([
    repo.modules.list(),
    repo.riskCategories.list(),
    repo.vesselTypes.list(),
    repo.auditTypes.list(),
    repo.questions.list(),
  ]);
  return { modules, riskCategories, vesselTypes, auditTypes, questions };
}

const preview = async (csv: string) => validateImport(parseCsv(csv), await context());

beforeEach(async () => {
  setMockDelay(0);
  localStorage.clear();
  forgetMemoryState();
  await repo.demo.reset();
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, line breaks, CRLF and an Excel BOM", () => {
    const text = '﻿a,b\r\n"one, two","say ""hi"""\r\n"multi\nline",x';
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["one, two", 'say "hi"'],
      ["multi\nline", "x"],
    ]);
  });

  it("round-trips through toCsv", () => {
    const rows = [["a,b", 'q"uote', "plain"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("validateImport", () => {
  it("accepts the downloadable template as-is", async () => {
    const result = await preview(buildTemplateCsv());
    expect(result).toMatchObject({ fileErrors: [], validCount: 2, invalidCount: 0 });
    expect(result.rows[1].input).toMatchObject({
      moduleId: "mod-navigation-watch",
      weight: 2,
      evidenceRequired: true,
      criticalControl: true,
      vesselTypeIds: ["vt-psv", "vt-ahts", "vt-crew-boat"],
      auditTypeIds: ["at-mfe", "at-spot-check"],
    });
  });

  it("matches names ignoring case, in any column order, with defaults for blanks", async () => {
    const result = await preview(
      "Text,MODULE,riskcategory,auditTypes,vesselTypes,evidenceRequired,weight\n" +
        "I have checked the CCTV covers the gangway.,security,SECURITY,spot_check,psv,,\n",
    );
    expect(result.validCount).toBe(1);
    expect(result.rows[0].input).toMatchObject({
      moduleId: "mod-security",
      riskCategoryId: "rc-security",
      weight: 1,
      evidenceRequired: false,
      criticalControl: false,
      vesselTypeIds: ["vt-psv"],
      auditTypeIds: ["at-spot-check"],
    });
  });

  it("reports every problem on each row", async () => {
    const result = await preview(
      [
        HEADER,
        "Diving,Hi,Safety,9,maybe,Submarine,Audit X",
        "Security,I have checked access control to the vessel is working.,Security,1,no,,",
        "Security,I have checked the CCTV covers the gangway.,Security,1,no,,",
        "Security,i have checked the cctv covers the gangway.,Security,1,no,,",
      ].join("\n"),
    );
    expect(result).toMatchObject({ validCount: 1, invalidCount: 3 });
    expect(result.rows[0].errors).toEqual([
      'Unknown module "Diving"',
      "text is required (at least 5 characters)",
      'Unknown riskCategory "Safety"',
      'weight must be a whole number from 1 to 5 (got "9")',
      'evidenceRequired must be yes or no (got "maybe")',
      'Unknown vessel type "Submarine"',
      'Unknown audit type "Audit X"',
    ]);
    expect(result.rows[1].errors).toEqual(["Duplicate: Security already has this question"]);
    expect(result.rows[2].errors).toEqual([]);
    expect(result.rows[3].errors).toEqual(["Duplicate: Security already has this question"]);
    expect(result.rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
  });

  it("rejects files with missing columns or no content", async () => {
    expect((await preview("module,text\nSecurity,Something long enough")).fileErrors[0]).toMatch(/Missing columns: riskCategory/);
    expect((await preview("\n\n")).fileErrors).toEqual(["The file is empty."]);
  });
});

describe("importQuestions", () => {
  it("saves only valid rows, appended to each module in file order", async () => {
    const result = await preview(
      [
        HEADER,
        "Security,I have checked the CCTV covers the gangway.,Security,1,no,,",
        "Galley,Bad row,Unknown,1,no,,",
        "Security,I have checked the search area is lit at night.,Security,3,yes,,",
      ].join("\n"),
    );
    const created = await importQuestions(admin, result);
    expect(created.map((q) => [q.moduleId, q.displayOrder, q.weight])).toEqual([
      ["mod-security", 6, 1],
      ["mod-security", 7, 3],
    ]);
    expect(await repo.questions.list({ moduleId: "mod-security" })).toHaveLength(7);
  });

  it("is admin-only", async () => {
    const result = await preview(buildTemplateCsv());
    await expect(importQuestions({ id: "usr-sup-tunde", role: "SUPERVISOR", status: "ACTIVE" }, result)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("createMany", () => {
  it("saves nothing if any input is invalid", async () => {
    const before = (await repo.questions.list()).length;
    const good = {
      moduleId: "mod-security",
      text: "I have checked something new.",
      riskCategoryId: "rc-security",
      weight: 1,
      criticalControl: false,
      evidenceRequired: false,
      vesselTypeIds: [],
      auditTypeIds: [],
      displayOrder: 99,
    };
    await expect(repo.questions.createMany([good, { ...good, moduleId: "mod-missing" }])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await repo.questions.list()).toHaveLength(before);
  });
});
