import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MotionProvider } from "~/components/motion-provider";
import { CENDARO_BRAND_MONOGRAM_64, CopilotCoreSvg } from "./copilot-core-svg";
import {
  buildMergedSheetHref,
  resolveCopilotModuleContext,
} from "./floating-ai-copilot";

(globalThis as unknown as { React: typeof React }).React = React;

describe("Cendaro Brand Monogram & Copilot UI/UX Guardrails", () => {
  it("renders all 4 official Cendaro monogram ribbons across all 4 states inside <MotionProvider> (LazyMotion strict)", () => {
    for (const state of ["idle", "hovered", "thinking", "open"] as const) {
      const html = renderToString(
        <MotionProvider>
          <CopilotCoreSvg state={state} size={22} />
        </MotionProvider>,
      );
      expect(html).toContain("<svg");
      expect(html).toContain('viewBox="0 0 64 64"');
      // Verifies all 4 interlocking pieces of the official Cendaro logo are present
      expect(html).toContain(CENDARO_BRAND_MONOGRAM_64.outerSpine.slice(0, 18));
      expect(html).toContain(CENDARO_BRAND_MONOGRAM_64.innerHook.slice(0, 18));
      expect(html).toContain(
        CENDARO_BRAND_MONOGRAM_64.upperKeystone.slice(0, 18),
      );
      expect(html).toContain(CENDARO_BRAND_MONOGRAM_64.lowerJaw.slice(0, 18));
      // Guarantees zero low-contrast status-info-fg inside primary emblem
      expect(html).not.toContain("--status-info-fg");
    }
  });

  it("enforces LazyMotion strict, 12px minimum typography, and zero text-opacity modifiers across Copilot components", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter(
      (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
    );
    expect(files.length).toBeGreaterThanOrEqual(2);

    for (const file of files) {
      const code = readFileSync(path.join(dir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      expect(code, `${file} must use <m.*> instead of <motion.*>`).not.toMatch(
        /<motion\./,
      );
      expect(
        code,
        `${file} must import { m } instead of { motion } from framer-motion`,
      ).not.toMatch(
        /import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*["']framer-motion["']/,
      );
      expect(
        code,
        `${file} must not use sub-12px arbitrary font sizes (DESIGN.md §3)`,
      ).not.toMatch(/\btext-\[(?:9|10|11)px\]/);
      expect(
        code,
        `${file} must not apply opacity modifiers to text tokens (DESIGN.md §2)`,
      ).not.toMatch(
        /\btext-(?:foreground|muted-foreground|primary-foreground|secondary-foreground)\/\d+/,
      );
    }
  });

  it("preserves existing nuqs table query params when opening GlobalSheets (?orderId=, ?customerId=, ?productId=)", () => {
    const mergedOrder = buildMergedSheetHref(
      "/orders",
      "?statuses=pending,confirmed&channel=whatsapp",
      "?orderId=ord-001",
    );
    expect(mergedOrder.opensGlobalSheet).toBe(true);
    expect(mergedOrder.nextUrl).toBe(
      "/orders?statuses=pending%2Cconfirmed&channel=whatsapp&orderId=ord-001",
    );

    // Switching from ?customerId= to ?orderId= replaces the sheet key while keeping table filters
    const switchedSheet = buildMergedSheetHref(
      "/orders",
      "?channel=store&customerId=cust-old",
      "?orderId=ord-002",
    );
    expect(switchedSheet.opensGlobalSheet).toBe(true);
    expect(switchedSheet.nextUrl).toBe("/orders?channel=store&orderId=ord-002");

    // Full route navigation does not mark opensGlobalSheet
    const fullRoute = buildMergedSheetHref(
      "/orders",
      "?channel=store",
      "/invoices",
    );
    expect(fullRoute).toEqual({
      nextUrl: "/invoices",
      opensGlobalSheet: false,
    });
  });

  it("tailors starter prompts to active pathname while strictly respecting role permissions", () => {
    const ownerInv = resolveCopilotModuleContext("/invoices", "owner");
    expect(ownerInv.moduleLabel).toBe("Facturación");
    expect(
      ownerInv.starters.some((s) => s.prompt.toLowerCase().includes("factura")),
    ).toBe(true);

    const ownerCont = resolveCopilotModuleContext("/containers", "owner");
    expect(ownerCont.moduleLabel).toBe("Contenedores");
    expect(
      ownerCont.starters.some((s) =>
        s.prompt.toLowerCase().includes("contenedor"),
      ),
    ).toBe(true);

    // Marketing role has catalog + marketplace access, NOT orders / receivables / containers / inventory
    const mktOnOrders = resolveCopilotModuleContext("/catalog", "marketing");
    expect(mktOnOrders.moduleLabel).toBe("Catálogo y Precios");
    for (const s of mktOnOrders.starters) {
      const lower = s.prompt.toLowerCase();
      expect(lower).not.toContain("vencidas");
      expect(lower).not.toContain("factura");
      expect(lower).not.toContain("stock");
    }
  });
});
