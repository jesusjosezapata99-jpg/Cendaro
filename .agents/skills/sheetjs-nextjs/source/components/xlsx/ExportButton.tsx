"use client";

import { downloadAsXlsx, downloadMultiSheet } from "@/lib/xlsx/download";

interface ExportButtonProps<T extends object> {
  rows: T[];
  filename?: string;
  sheetName?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * One-click client-side xlsx export button.
 * Disabled automatically when rows is empty.
 *
 * @example
 * <ExportButton rows={filteredData} filename="q4-report.xlsx" />
 */
export function ExportButton<T extends object>({
  rows,
  filename = "export.xlsx",
  sheetName = "Sheet1",
  children = "Export to Excel",
  disabled = false,
  className,
}: ExportButtonProps<T>) {
  return (
    <button
      disabled={disabled || rows.length === 0}
      onClick={() => downloadAsXlsx(rows, filename, sheetName)}
      className={className}
    >
      {children}
    </button>
  );
}

interface MultiSheetExportButtonProps {
  sheets: { name: string; rows: object[] }[];
  filename?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Export multiple named sheets into a single xlsx file.
 *
 * @example
 * <MultiSheetExportButton
 *   sheets={[{ name: "Q1", rows: q1 }, { name: "Q2", rows: q2 }]}
 *   filename="annual-report.xlsx"
 * />
 */
export function MultiSheetExportButton({
  sheets,
  filename = "export.xlsx",
  children = "Export All Sheets",
  disabled = false,
  className,
}: MultiSheetExportButtonProps) {
  const isEmpty = sheets.every((s) => s.rows.length === 0);
  return (
    <button
      disabled={disabled || isEmpty}
      onClick={() => downloadMultiSheet(sheets, filename)}
      className={className}
    >
      {children}
    </button>
  );
}
