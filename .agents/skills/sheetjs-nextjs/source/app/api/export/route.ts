import { NextRequest } from "next/server";
import { xlsxMultiSheetResponse, xlsxResponse } from "@/lib/xlsx/server";

// GET /api/export  →  single-sheet download
export async function GET(req: NextRequest) {
  // Replace with your real data source (DB query, fetch, etc.)
  const data = [
    { Name: "Alice", Department: "Engineering", Salary: 95000 },
    { Name: "Bob", Department: "Design", Salary: 88000 },
  ];

  return xlsxResponse(data, "employees.xlsx", "Employees");
}

// POST /api/export  →  multi-sheet download from request body
// Body: { sheets: [{ name: string, rows: object[] }], filename?: string }
export async function POST(req: NextRequest) {
  const { sheets, filename } = await req.json();
  return xlsxMultiSheetResponse(sheets, filename ?? "export.xlsx");
}
