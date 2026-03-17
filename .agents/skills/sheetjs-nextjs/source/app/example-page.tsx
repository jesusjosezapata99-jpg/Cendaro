"use client";

import { useState } from "react";
import { ExportButton } from "@/components/xlsx/ExportButton";
import { FileUploader } from "@/components/xlsx/FileUploader";
import { SheetTable } from "@/components/xlsx/SheetTable";

// 1. Define your data shape
interface Employee {
  Name: string;
  Department: string;
  Salary: number;
}

export default function EmployeeImportPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Employee Import</h1>

      {/* 2. Upload */}
      <FileUploader<Employee>
        onData={(data) => {
          setError(null);
          setRows(data);
        }}
        onError={(e) => setError(e.message)}
        label="Drop an .xlsx or .csv file here, or click to browse"
      />

      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}

      {/* 3. Preview */}
      {rows.length > 0 && (
        <>
          <p style={{ marginTop: "1rem", color: "#555" }}>
            {rows.length} rows loaded
          </p>
          <SheetTable rows={rows as Record<string, unknown>[]} maxRows={50} />

          {/* 4. Export */}
          <ExportButton
            rows={rows}
            filename="employees-export.xlsx"
            sheetName="Employees"
            style={{ marginTop: "1rem" }}
          >
            ⬇ Download as Excel
          </ExportButton>
        </>
      )}
    </main>
  );
}
