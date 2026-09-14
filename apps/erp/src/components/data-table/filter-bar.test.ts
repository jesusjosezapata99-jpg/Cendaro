/**
 * Cendaro — DataTable FilterBar Unit Tests (T4.2)
 *
 * Validates FilterBar subcomponents and export surface.
 */
import { describe, expect, it } from "vitest";

import {
  DataTableFilterBar,
  DataTableFilterChips,
  DataTableFilterPopover,
  DataTableSearchInput,
} from "./index";

describe("DataTable FilterBar exports and components (T4.2)", () => {
  it("exports all filter bar components from data-table barrel", () => {
    expect(DataTableFilterBar).toBeDefined();
    expect(DataTableFilterChips).toBeDefined();
    expect(DataTableFilterPopover).toBeDefined();
    expect(DataTableSearchInput).toBeDefined();
  });
});
