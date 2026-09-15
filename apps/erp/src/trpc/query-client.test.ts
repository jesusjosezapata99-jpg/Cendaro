/**
 * Cendaro — QueryClient Cache Policies Unit Tests (T8.2)
 *
 * Verifies that the QueryClient sets correct hierarchical stale times:
 * - Default transactional queries: 30 seconds
 * - Static catalogs (brands, categories, suppliers, workspaces, users.me): 5 minutes
 * - Exchange rates: 60 seconds
 */
import { describe, expect, it } from "vitest";

import { makeQueryClient, STALE_TIMES } from "./query-client";

describe("QueryClient Cache Policies (T8.2)", () => {
  const client = makeQueryClient();

  it("applies default 30s staleTime to transactional list queries", () => {
    const defaultOptions = client.getDefaultOptions().queries;
    expect(defaultOptions?.staleTime).toBe(STALE_TIMES.LISTS);
    expect(defaultOptions?.staleTime).toBe(30_000);
  });

  it("applies 5 min staleTime to catalog queries via query defaults", () => {
    const brandsOptions = client.getQueryDefaults([["catalog", "listBrands"]]);
    expect(brandsOptions.staleTime).toBe(STALE_TIMES.CATALOGS);
    expect(brandsOptions.staleTime).toBe(300_000);

    const categoriesOptions = client.getQueryDefaults([
      ["catalog", "listCategories"],
    ]);
    expect(categoriesOptions.staleTime).toBe(STALE_TIMES.CATALOGS);

    const suppliersOptions = client.getQueryDefaults([
      ["catalog", "listSuppliers"],
    ]);
    expect(suppliersOptions.staleTime).toBe(STALE_TIMES.CATALOGS);

    const workspaceListOptions = client.getQueryDefaults([
      ["workspace", "list"],
    ]);
    expect(workspaceListOptions.staleTime).toBe(STALE_TIMES.CATALOGS);

    const userMeOptions = client.getQueryDefaults([["users", "me"]]);
    expect(userMeOptions.staleTime).toBe(STALE_TIMES.CATALOGS);
  });

  it("applies 60s staleTime to currency and exchange rate queries", () => {
    const latestRatesOptions = client.getQueryDefaults([
      ["pricing", "latestRates"],
    ]);
    expect(latestRatesOptions.staleTime).toBe(STALE_TIMES.RATES);
    expect(latestRatesOptions.staleTime).toBe(60_000);

    const historyOptions = client.getQueryDefaults([
      ["pricing", "listRateHistory"],
    ]);
    expect(historyOptions.staleTime).toBe(STALE_TIMES.RATES);
  });
});
