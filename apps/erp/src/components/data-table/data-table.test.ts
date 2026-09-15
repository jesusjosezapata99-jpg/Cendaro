/**
 * Cendaro — DataTable Core Unit Tests (T4.1)
 *
 * Validates sort parsing/formatting utilities, column meta properties,
 * and data-table core contracts.
 */
import { describe, expect, it } from "vitest";

import { formatSortParam, parseSortParam } from "./types";

describe("DataTable Sort Utilities", () => {
  it("parses valid sort query parameters into column and direction", () => {
    expect(parseSortParam("createdAt:asc")).toEqual({
      column: "createdAt",
      direction: "asc",
    });

    expect(parseSortParam("total:desc")).toEqual({
      column: "total",
      direction: "desc",
    });

    expect(parseSortParam("orderNumber:asc")).toEqual({
      column: "orderNumber",
      direction: "asc",
    });
  });

  it("returns null for invalid or empty sort query parameters", () => {
    expect(parseSortParam("")).toBeNull();
    expect(parseSortParam(null)).toBeNull();
    expect(parseSortParam(undefined)).toBeNull();
    expect(parseSortParam("invalid")).toBeNull();
    expect(parseSortParam("column:invalidDirection")).toBeNull();
    expect(parseSortParam(":asc")).toBeNull();
  });

  it("formats column and direction into sort string param", () => {
    expect(formatSortParam("name", "asc")).toBe("name:asc");
    expect(formatSortParam("sku", "desc")).toBe("sku:desc");
    expect(formatSortParam("createdAt", "desc")).toBe("createdAt:desc");
  });
});
