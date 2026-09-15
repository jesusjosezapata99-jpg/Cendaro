#!/usr/bin/env node
/**
 * auth-surface-sweep.mjs — Cendaro ERP Authentication Surface Sweep (Phase C3)
 *
 * Verifies that unauthenticated requests to protected routes ALWAYS receive a redirect (307/308)
 * or 401/404, and NEVER return HTTP 200 OK.
 * Only explicit public endpoints are permitted to return 200.
 */

const BASE_URL = "http://localhost:3000";

const TEST_CASES = [
  // Public routes (allowed 200)
  { path: "/", expect: "PUBLIC", desc: "Landing root" },
  { path: "/login", expect: "PUBLIC", desc: "Login page" },
  { path: "/opengraph-image", expect: "PUBLIC", desc: "OG Image" },
  { path: "/api/bcv-rate", expect: "PUBLIC", desc: "Public BCV rate endpoint" },

  // Standard protected routes (MUST NOT be 200)
  { path: "/dashboard", expect: "PROTECTED", desc: "Dashboard" },
  { path: "/pos", expect: "PROTECTED", desc: "POS" },
  { path: "/orders", expect: "PROTECTED", desc: "Orders list" },
  { path: "/catalog", expect: "PROTECTED", desc: "Catalog" },
  { path: "/inventory", expect: "PROTECTED", desc: "Inventory" },
  { path: "/customers", expect: "PROTECTED", desc: "Customers" },
  { path: "/settings", expect: "PROTECTED", desc: "Settings" },

  // Case variations
  { path: "/Dashboard", expect: "PROTECTED", desc: "Uppercase /Dashboard" },
  { path: "/Orders", expect: "PROTECTED", desc: "Uppercase /Orders" },
  { path: "/Catalog", expect: "PROTECTED", desc: "Uppercase /Catalog" },

  // Trailing slash variations
  { path: "/dashboard/", expect: "PROTECTED", desc: "Trailing slash /dashboard/" },
  { path: "/orders/", expect: "PROTECTED", desc: "Trailing slash /orders/" },
  { path: "/settings/", expect: "PROTECTED", desc: "Trailing slash /settings/" },

  // URL encoded variations
  { path: "/%64ashboard", expect: "PROTECTED", desc: "Hex encoded %64 (/dashboard)" },
  { path: "/%63atalog", expect: "PROTECTED", desc: "Hex encoded %63 (/catalog)" },

  // Former /en route bypass variations
  { path: "/en", expect: "PROTECTED_OR_404", desc: "Root /en" },
  { path: "/en/dashboard", expect: "PROTECTED_OR_404", desc: "/en/dashboard" },
  { path: "/en/orders", expect: "PROTECTED_OR_404", desc: "/en/orders" },

  // Arbitrary prefix variations
  { path: "/admin/dashboard", expect: "PROTECTED_OR_404", desc: "/admin/dashboard" },
  { path: "/app/dashboard", expect: "PROTECTED_OR_404", desc: "/app/dashboard" },
  { path: "/api/trpc/dashboard.overview", expect: "TRPC_AUTH_REQUIRED", desc: "tRPC procedure without auth" },
];

console.log("==================================================");
console.log("🔒 Cendaro ERP — Authentication Surface Sweep (C3)");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Total Cases: ${TEST_CASES.length}`);
console.log("==================================================\n");

async function run() {
  const results = [];
  let violations = 0;

  for (const tc of TEST_CASES) {
    const url = `${BASE_URL}${tc.path}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual", // Do NOT follow redirects
      });

      const status = res.status;
      const location = res.headers.get("location") ?? "-";
      let pass = false;

      if (tc.expect === "PUBLIC") {
        pass = status === 200;
      } else if (tc.expect === "PROTECTED") {
        // Must redirect to /login directly or via canonical trailing-slash redirect (308 -> 307 -> /login)
        if ((status === 307 || status === 308 || status === 302) && location.includes("/login")) {
          pass = true;
        } else if (status === 308) {
          // Verify followed destination
          const followRes = await fetch(`${BASE_URL}${location}`, { redirect: "manual" });
          pass = followRes.status === 307 && (followRes.headers.get("location") ?? "").includes("/login");
        }
      } else if (tc.expect === "PROTECTED_OR_404") {
        // Redirect to login or 404
        pass = status === 404 || ((status === 307 || status === 308 || status === 302) && location.includes("/login"));
      } else if (tc.expect === "TRPC_AUTH_REQUIRED") {
        // tRPC responds with 401 or 400 or error JSON, never 200 with data
        pass = status === 401 || status === 400 || status === 404;
      }

      if (!pass) {
        violations++;
      }

      results.push({
        path: tc.path,
        description: tc.desc,
        expected: tc.expect,
        status,
        redirectLocation: location,
        result: pass ? "PASS" : "VIOLATION",
      });

      console.log(`[${pass ? "✓" : "❌"}] ${tc.path.padEnd(30)} -> HTTP ${status} (${pass ? "SECURE" : "UNAUTHORIZED ACCESS"})`);
    } catch (err) {
      violations++;
      results.push({
        path: tc.path,
        description: tc.desc,
        expected: tc.expect,
        status: "ERROR",
        redirectLocation: err.message,
        result: "FAIL",
      });
      console.log(`[❌] ${tc.path.padEnd(30)} -> Error: ${err.message}`);
    }
  }

  console.log("\n==================================================");
  console.log("📊 Auth Sweep Summary Table");
  console.table(results);
  console.log("==================================================");

  if (violations > 0) {
    console.error(`\n🚨 CRITICAL SECURITY FAILURE: ${violations} authentication boundary violations detected!`);
    process.exit(1);
  } else {
    console.log(`\n🎉 100% SECURE: 0 authentication bypasses found across all ${TEST_CASES.length} test vectors!`);
    process.exit(0);
  }
}

run();
