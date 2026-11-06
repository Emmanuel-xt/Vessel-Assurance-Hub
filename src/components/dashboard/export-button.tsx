"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { exportRows, type Period, type PreparedData, type SheetRows } from "@/lib/services/dashboard";
import type { Assessment } from "@/lib/types";

/** Column widths from the longest value (capped), so the sheet is readable when opened. */
function columnWidths(rows: SheetRows) {
  const headers = Object.keys(rows[0] ?? {});
  return headers.map((h) => ({
    wch: Math.min(60, Math.max(h.length, ...rows.slice(0, 500).map((r) => String(r[h] ?? "").length)) + 2),
  }));
}

/** Builds the workbook in the browser (SheetJS, loaded only when clicked). Nothing is uploaded. */
export function ExportButton({ data, assessments, period }: { data: PreparedData; assessments: Assessment[]; period: Period }) {
  const [busy, setBusy] = useState(false);

  async function exportWorkbook() {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const sheets = exportRows(data, assessments);
      const workbook = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(sheets)) {
        const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Note: "No rows for these filters." }]);
        sheet["!cols"] = columnWidths(rows);
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      }
      XLSX.writeFile(workbook, `vah-dashboard-${period.from}-to-${period.to}.xlsx`);
      toast.success(
        `Exported ${sheets.Assessments.length} assessments, ${sheets.Responses.length} responses and ${sheets.Findings.length} findings`,
      );
    } catch (error) {
      toast.error(`Export failed: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" className="h-11 px-4" onClick={exportWorkbook} disabled={busy || assessments.length === 0}>
      {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Export to Excel
    </Button>
  );
}
