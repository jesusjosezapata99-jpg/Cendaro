import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MotionProvider } from "~/components/motion-provider";
import { CopilotCoreSvg } from "./copilot-core-svg";

(globalThis as unknown as { React: typeof React }).React = React;

describe("Copilot LazyMotion strict compatibility", () => {
  it("renders all 4 CopilotCoreSvg kinetic states inside <MotionProvider> (LazyMotion strict) without throwing", () => {
    for (const state of ["idle", "hovered", "thinking", "open"] as const) {
      const html = renderToString(
        <MotionProvider>
          <CopilotCoreSvg state={state} size={26} />
        </MotionProvider>,
      );
      expect(html).toContain("<svg");
      expect(html).toContain('viewBox="0 0 64 64"');
    }
  });

  it("forbids heavy `motion.*` imports/JSX across all Copilot components so `<LazyMotion strict>` never throws in client effects", () => {
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
    }
  });
});
