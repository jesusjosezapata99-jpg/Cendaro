"use client";

import { useCallback, useState } from "react";
import { fileToJson } from "@/lib/xlsx/upload";

interface FileUploaderProps<T> {
  onData: (rows: T[]) => void;
  onError?: (err: Error) => void;
  /** File types to accept. Defaults to xlsx, xls, csv */
  accept?: string;
  label?: string;
  className?: string;
}

/**
 * Generic file uploader that parses the first sheet of an xlsx/csv file.
 *
 * @example
 * interface Product { Name: string; Price: number }
 * <FileUploader<Product> onData={(rows) => setProducts(rows)} />
 */
export function FileUploader<T>({
  onData,
  onError,
  accept = ".xlsx,.xls,.csv",
  label = "Click or drag a spreadsheet here",
  className,
}: FileUploaderProps<T>) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const process = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const rows = await fileToJson<T>(file);
        onData(rows);
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    },
    [onData, onError],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) process(file);
    },
    [process],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={className}
      style={{
        border: `2px dashed ${dragging ? "#0070f3" : "#ccc"}`,
        borderRadius: 8,
        padding: "2rem",
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 0.2s",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <input
        type="file"
        accept={accept}
        style={{ display: "none" }}
        id="xlsx-file-upload"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) process(file);
          // Reset so same file can be re-uploaded
          e.target.value = "";
        }}
      />
      <label htmlFor="xlsx-file-upload" style={{ cursor: "pointer" }}>
        {loading ? "Processing…" : label}
      </label>
    </div>
  );
}
