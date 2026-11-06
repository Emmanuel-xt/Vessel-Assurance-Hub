// Bulk question import from CSV: parse → validate each row → preview → save the valid rows.

import { questions } from "@/lib/data";
import type { QuestionCreateInput } from "@/lib/data";
import { requireAdmin } from "@/lib/services/admin/shared";
import type { Principal } from "@/lib/services/permissions";
import { WEIGHT_MAX, WEIGHT_MIN } from "@/lib/services/questions";
import type { AuditType, LookupItem, Module, Question } from "@/lib/types";

// ---------- CSV ----------

/**
 * Parses CSV text into rows of cells (RFC 4180): quoted fields, "" escapes, commas and line breaks inside quotes,
 * CRLF or LF line endings, and the byte-order mark Excel adds when saving "CSV UTF-8".
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ---------- Columns & template ----------

export const REQUIRED_COLUMNS = [
  "module",
  "text",
  "riskCategory",
  "weight",
  "evidenceRequired",
  "vesselTypes",
  "auditTypes",
] as const;
export const OPTIONAL_COLUMNS = ["criticalControl"] as const;
export const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
type Column = (typeof ALL_COLUMNS)[number];

/** Downloadable template: header plus two example rows. */
export function buildTemplateCsv(): string {
  return toCsv([
    [...ALL_COLUMNS],
    ["Security", "I have checked the gangway watch is in place.", "Security", "1", "no", "", "", "no"],
    [
      "Navigation Watch",
      "I have confirmed the radar is set up for the current sea state.",
      "Marine Operations",
      "2",
      "yes",
      "PSV;AHTS;Crew Boat",
      "MFE;Spot Check",
      "yes",
    ],
  ]);
}

// ---------- Validation ----------

export interface ImportContext {
  modules: Module[];
  riskCategories: LookupItem[];
  vesselTypes: LookupItem[];
  auditTypes: AuditType[];
  /** Existing questions, to catch duplicates. */
  questions: Question[];
}

export interface ImportRow {
  /** Line number in the file (header is line 1). */
  line: number;
  /** Raw cell values by column, for the preview. */
  cells: Record<Column, string>;
  /** Ready to save when there are no errors. displayOrder is assigned on import. */
  input: Omit<QuestionCreateInput, "displayOrder"> | null;
  errors: string[];
}

export interface ImportPreview {
  /** Problems with the file as a whole (e.g. missing columns). When present, no rows are listed. */
  fileErrors: string[];
  rows: ImportRow[];
  validCount: number;
  invalidCount: number;
}

const key = (value: string) => value.trim().toLowerCase();

const BOOLEAN_VALUES: Record<string, boolean> = { yes: true, y: true, true: true, "1": true, no: false, n: false, false: false, "0": false };

function parseBoolean(raw: string, column: string, errors: string[]): boolean {
  if (raw.trim() === "") return false;
  const value = BOOLEAN_VALUES[key(raw)];
  if (value === undefined) errors.push(`${column} must be yes or no (got "${raw.trim()}")`);
  return value ?? false;
}

function parseList<T extends { id: string }>(
  raw: string,
  column: string,
  find: (name: string) => T | undefined,
  errors: string[],
): string[] {
  const names = raw.split(";").map((n) => n.trim()).filter(Boolean);
  const ids: string[] = [];
  for (const name of names) {
    const match = find(name);
    if (match) ids.push(match.id);
    else errors.push(`Unknown ${column} "${name}"`);
  }
  return [...new Set(ids)];
}

/** Validates every row of a parsed CSV against the current reference data. */
export function validateImport(table: string[][], context: ImportContext): ImportPreview {
  const nonEmpty = table.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return { fileErrors: ["The file is empty."], rows: [], validCount: 0, invalidCount: 0 };

  const header = nonEmpty[0].map(key);
  const columnIndex = Object.fromEntries(ALL_COLUMNS.map((c) => [c, header.indexOf(c.toLowerCase())])) as Record<Column, number>;
  const missing = REQUIRED_COLUMNS.filter((c) => columnIndex[c] === -1);
  if (missing.length > 0) {
    return {
      fileErrors: [`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template to see the expected header.`],
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  const byName = <T extends { name: string }>(items: T[]) => (name: string) => items.find((i) => key(i.name) === key(name));
  const findModule = byName(context.modules);
  const findRisk = byName(context.riskCategories);
  const findVesselType = byName(context.vesselTypes);
  const findAuditType = (name: string) =>
    context.auditTypes.find((t) => key(t.name) === key(name) || key(t.code) === key(name));

  const seen = new Set(context.questions.map((q) => `${q.moduleId}|${key(q.text)}`));
  const lineOf = new Map<string[], number>(table.map((row, i) => [row, i + 1]));

  const rows: ImportRow[] = nonEmpty.slice(1).map((row) => {
    const cells = Object.fromEntries(
      ALL_COLUMNS.map((c) => [c, columnIndex[c] === -1 ? "" : (row[columnIndex[c]] ?? "").trim()]),
    ) as Record<Column, string>;
    const errors: string[] = [];

    const moduleMatch = cells.module ? findModule(cells.module) : undefined;
    if (!cells.module) errors.push("module is required");
    else if (!moduleMatch) errors.push(`Unknown module "${cells.module}"`);

    const text = cells.text;
    if (text.length < 5) errors.push("text is required (at least 5 characters)");
    else if (text.length > 300) errors.push("text must be under 300 characters");

    const risk = cells.riskCategory ? findRisk(cells.riskCategory) : undefined;
    if (!cells.riskCategory) errors.push("riskCategory is required");
    else if (!risk) errors.push(`Unknown riskCategory "${cells.riskCategory}"`);

    let weight = 1;
    if (cells.weight !== "") {
      weight = Number(cells.weight);
      if (!Number.isInteger(weight) || weight < WEIGHT_MIN || weight > WEIGHT_MAX) {
        errors.push(`weight must be a whole number from ${WEIGHT_MIN} to ${WEIGHT_MAX} (got "${cells.weight}")`);
      }
    }

    const evidenceRequired = parseBoolean(cells.evidenceRequired, "evidenceRequired", errors);
    const criticalControl = parseBoolean(cells.criticalControl, "criticalControl", errors);
    const vesselTypeIds = parseList(cells.vesselTypes, "vessel type", findVesselType, errors);
    const auditTypeIds = parseList(cells.auditTypes, "audit type", findAuditType, errors);

    if (moduleMatch && text.length >= 5) {
      const duplicateKey = `${moduleMatch.id}|${key(text)}`;
      if (seen.has(duplicateKey)) errors.push(`Duplicate: ${moduleMatch.name} already has this question`);
      else if (errors.length === 0) seen.add(duplicateKey);
    }

    const input =
      errors.length === 0 && moduleMatch && risk
        ? {
            moduleId: moduleMatch.id,
            text,
            riskCategoryId: risk.id,
            weight,
            criticalControl,
            evidenceRequired,
            vesselTypeIds,
            auditTypeIds,
            active: true,
          }
        : null;

    return { line: lineOf.get(row) ?? 0, cells, input, errors };
  });

  const validCount = rows.filter((r) => r.input).length;
  return { fileErrors: [], rows, validCount, invalidCount: rows.length - validCount };
}

// ---------- Save ----------

/** Saves the valid rows in one go, each added to the end of its module in file order. */
export async function importQuestions(actor: Principal, preview: ImportPreview): Promise<Question[]> {
  requireAdmin(actor);
  const inputs = preview.rows.flatMap((r) => (r.input ? [r.input] : []));
  if (inputs.length === 0) return [];

  const existing = await questions.list();
  const nextOrder = new Map<string, number>();
  const withOrder: QuestionCreateInput[] = inputs.map((input) => {
    const order =
      nextOrder.get(input.moduleId) ?? existing.filter((q) => q.moduleId === input.moduleId).reduce((m, q) => Math.max(m, q.displayOrder), 0) + 1;
    nextOrder.set(input.moduleId, order + 1);
    return { ...input, displayOrder: order };
  });
  return questions.createMany(withOrder);
}
