"use client";

interface SheetTableProps {
  rows: Record<string, unknown>[];
  /** Max rows to render before truncating. Defaults to 100. */
  maxRows?: number;
  /** Override which columns to display and their order */
  columns?: string[];
  className?: string;
}

/**
 * Auto-generates a table from an array of objects.
 * Columns are derived from the keys of the first row unless overridden.
 *
 * @example
 * <SheetTable rows={uploadedRows as Record<string, unknown>[]} maxRows={50} />
 */
export function SheetTable({
  rows,
  maxRows = 100,
  columns,
  className,
}: SheetTableProps) {
  if (!rows.length) return <p style={{ color: "#888" }}>No data to display.</p>;

  const cols = columns ?? Object.keys(rows[0]);
  const visible = rows.slice(0, maxRows);

  return (
    <div style={{ overflowX: "auto" }} className={className}>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          fontSize: "0.875rem",
        }}
      >
        <thead>
          <tr>
            {cols.map((col) => (
              <th
                key={col}
                style={{
                  border: "1px solid #e2e8f0",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  textAlign: "left",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr
              key={i}
              style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
            >
              {cols.map((col) => (
                <td
                  key={col}
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "6px 12px",
                    maxWidth: 300,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: 6 }}>
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
}
