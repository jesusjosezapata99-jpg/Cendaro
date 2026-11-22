/**
 * Architectural Guard — Zero Concurrent `client.query()` on Single `pg.PoolClient` (`pg@9` Safety)
 *
 * Inside `runInWorkspaceRls` and `runInWorkspaceRlsReadonly` (including every
 * `wsPermissionProcedure`, `wsReadPermissionProcedure`, and `memberReadProcedure`),
 * `ctx.db` / `tx` is a single checked-out `pg.PoolClient`. Calling `Promise.all`
 * across queries bound to the same `PoolClient` emits Node's `pg` DeprecationWarning:
 *   "Calling client.query() when the client is already executing a query is deprecated
 *    and will be removed in pg@9.0."
 *
 * This guard scans all API routers, services, and AI routes to guarantee only
 * sequential `await` is used on transaction-bound database handles.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function collectProductionTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      results.push(...collectProductionTsFiles(fullPath));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("pg.PoolClient single-flight transaction guard (pg@9 readiness)", () => {
  it("forbids Promise.all over transaction-bound `ctx.db` / `tx` across all @cendaro/api modules, routers, services, and AI routes", () => {
    const apiSrc = path.resolve(__dirname, "..");
    const files = [
      ...collectProductionTsFiles(path.join(apiSrc, "modules")),
      ...collectProductionTsFiles(path.join(apiSrc, "routers")),
      ...collectProductionTsFiles(path.join(apiSrc, "services")),
      path.resolve(
        __dirname,
        "../../../../apps/erp/src/app/api/ai/parse-packing-list/route.ts",
      ),
    ];

    for (const filePath of files) {
      const code = readFileSync(filePath, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      // Find any `Promise.all([ ... ])` block and ensure it does not dispatch concurrent queries on `ctx.db` or `tx`
      const promiseAllRegex = /Promise\.all\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
      let match: RegExpExecArray | null;
      while ((match = promiseAllRegex.exec(code)) !== null) {
        const block = match[1] ?? "";
        const rel = path.relative(apiSrc, filePath);
        expect(
          block,
          `${rel} dispatches concurrent queries on transaction-bound ctx.db/tx inside Promise.all`,
        ).not.toMatch(/\b(?:ctx\.db|tx)\s*\./);
        expect(
          block,
          `${rel} dispatches concurrent DB helpers inside Promise.all`,
        ).not.toMatch(
          /\b(?:computeSales|computeGrossProfit|computeReceivables|computeLowStock|computePendingDispatch|computeRate|computeTopProducts|computeLastClosure|computeContainersInTransit|loadPromptConfig|buildCatalogContext)\s*\(/,
        );
      }
    }
  });
});
