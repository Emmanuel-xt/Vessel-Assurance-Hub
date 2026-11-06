"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileUp, XCircle } from "lucide-react";
import type { QuestionReferenceData } from "@/components/admin/question-form-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ALL_COLUMNS,
  buildTemplateCsv,
  importQuestions,
  parseCsv,
  validateImport,
  type ImportPreview,
} from "@/lib/services/question-import";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAdminAction } from "./use-admin-action";

interface QuestionImportSheetProps extends QuestionReferenceData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: Question[];
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "question-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function QuestionImportSheet(props: QuestionImportSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        {props.open && <ImportFlow {...props} />}
      </SheetContent>
    </Sheet>
  );
}

function ImportFlow({ onOpenChange, questions, ...reference }: QuestionImportSheetProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const save = useAdminAction((actor, p: ImportPreview) => importQuestions(actor, p), {
    success: (created) => `${created.length} question${created.length === 1 ? "" : "s"} imported`,
    invalidates: [["questions"], ["modules"]],
    onSuccess: () => onOpenChange(false),
  });

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again after fixing it
    if (!file) return;
    setFileName(file.name);
    setPreview(validateImport(parseCsv(await file.text()), { ...reference, questions }));
  }

  const names = (items: { name: string }[]) => items.map((i) => i.name).join(", ");

  return (
    <div className="flex min-h-full flex-col">
      <SheetHeader>
        <SheetTitle>Import questions from CSV</SheetTitle>
        <SheetDescription>Check the preview before anything is saved. Rows with errors are skipped.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 px-4">
        <section className="space-y-3 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">1. Start from the template</p>
            <Button variant="outline" size="sm" className="h-9" onClick={downloadTemplate}>
              <Download /> Download template
            </Button>
          </div>
          <p className="text-muted-foreground">
            Columns: <code className="text-xs">{ALL_COLUMNS.join(", ")}</code>. criticalControl is optional. Names are
            matched ignoring capitals. Separate several vessel or audit types with <code>;</code> and leave them empty
            to apply to all. Weight is 1–5 (blank = 1). Yes/no columns accept yes, no, true, false, 1 or 0.
          </p>
          <details className="text-muted-foreground">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium text-foreground">Valid names</summary>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div><dt className="inline font-medium text-foreground">module: </dt><dd className="inline">{names(reference.modules)}</dd></div>
              <div><dt className="inline font-medium text-foreground">riskCategory: </dt><dd className="inline">{names(reference.riskCategories)}</dd></div>
              <div><dt className="inline font-medium text-foreground">vesselTypes: </dt><dd className="inline">{names(reference.vesselTypes)}</dd></div>
              <div><dt className="inline font-medium text-foreground">auditTypes: </dt><dd className="inline">{reference.auditTypes.map((t) => `${t.name} (${t.code})`).join(", ")}</dd></div>
            </dl>
          </details>
        </section>

        <section className="space-y-2">
          <p className="text-sm font-medium">2. Choose your CSV file</p>
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm hover:bg-muted">
            <FileUp className="size-4" aria-hidden />
            {fileName ?? "Choose a .csv file"}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>
        </section>

        {preview && preview.fileErrors.length > 0 && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>This file can&apos;t be imported</AlertTitle>
            <AlertDescription>{preview.fileErrors.join(" ")}</AlertDescription>
          </Alert>
        )}

        {preview && preview.fileErrors.length === 0 && (
          <section className="space-y-2">
            <p className="text-sm font-medium">
              3. Preview: <span className="text-emerald-700">{preview.validCount} ready</span>
              {preview.invalidCount > 0 && <span className="text-destructive"> · {preview.invalidCount} with errors</span>}
            </p>
            {preview.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">The file has a header but no question rows.</p>
            ) : (
              <ol className="divide-y rounded-lg border text-sm">
                {preview.rows.map((row) => (
                  <li key={row.line} className={cn("flex gap-3 p-3", row.input ? "" : "bg-destructive/5")}>
                    {row.input ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Ready" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Has errors" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Row {row.line} · {row.cells.module || "(no module)"} · {row.cells.riskCategory || "(no risk category)"}
                        {row.cells.weight && ` · weight ${row.cells.weight}`}
                      </p>
                      <p className="break-words">{row.cells.text || <em className="text-muted-foreground">(no text)</em>}</p>
                      {row.errors.length > 0 && (
                        <ul className="list-disc space-y-0.5 pl-4 text-xs text-destructive">
                          {row.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      <SheetFooter className="flex-row gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          className="h-11 flex-1"
          disabled={!preview || preview.validCount === 0 || save.isPending}
          onClick={() => preview && save.mutate(preview)}
        >
          {save.isPending
            ? "Importing…"
            : preview && preview.validCount > 0
              ? `Import ${preview.validCount} valid row${preview.validCount === 1 ? "" : "s"}${
                  preview.invalidCount > 0 ? ` (${preview.invalidCount} skipped)` : ""
                }`
              : "Import"}
        </Button>
      </SheetFooter>
    </div>
  );
}
