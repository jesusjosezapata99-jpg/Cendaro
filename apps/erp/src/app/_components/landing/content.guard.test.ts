/**
 * Truth guard for the public site (PLAN-2026-09-LANDING-REDESIGN §4.3).
 *
 * The previous landing shipped invented testimonials, metrics, compliance
 * seals, prices and integrations. This test keeps them from coming back:
 * every claim needs evidence, and known-false phrases fail the build.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ERP_MODULES } from "@cendaro/validators";

import { CLAIMS, MODULES } from "./content";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");
const APP_DIR = resolve(HERE, "../..");

/** Directories whose source is public-site copy. */
const PUBLIC_DIRS = [HERE, join(APP_DIR, "(marketing)")];

/**
 * Phrases that were false on the previous landing (report
 * UI-REPORT-2026-09-LANDING-BASELINE §3 and plan §2.1). Extend, never shrink.
 */
const FORBIDDEN: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /SOC ?2/i, why: "no SOC 2 certification exists" },
  { pattern: /GDPR/i, why: "not a GDPR-scoped product; no compliance seal" },
  { pattern: /España|🇪🇸/i, why: "the company and market are Venezuelan" },
  { pattern: /horario europeo/i, why: "no European support team" },
  { pattern: /14 días/i, why: "there is no free trial" },
  { pattern: /prueba (gratis|gratuita|pro)/i, why: "there is no free trial" },
  { pattern: /empezar gratis/i, why: "public signup is disabled" },
  { pattern: /\$\s?\d+\s?\/\s?mes/i, why: "there are no public prices" },
  { pattern: /Stripe/i, why: "no Stripe integration" },
  { pattern: /Google Sheets/i, why: "no Google Sheets integration" },
  {
    pattern: /notificaciones automáticas por WhatsApp/i,
    why: "WhatsApp is manual wa.me links, no API",
  },
  {
    pattern: /categorización (inteligente )?con IA/i,
    why: "category suggestions are fuzzy matching; the AI reads packing lists",
  },
  { pattern: /[0-9]\s?de\s?5 estrellas/i, why: "no real ratings exist" },
];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(tsx?|mdx?)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !file.endsWith("content.guard.test.ts"));
}

function forbiddenPhrases(): string[] {
  const hits: string[] = [];
  for (const file of PUBLIC_DIRS.flatMap(sourceFiles)) {
    const text = readFileSync(file, "utf8");
    for (const { pattern, why } of FORBIDDEN) {
      if (pattern.test(text)) {
        hits.push(
          `${relative(REPO_ROOT, file)} — /${pattern.source}/ (${why})`,
        );
      }
    }
  }
  return hits;
}

describe("public-site claims", () => {
  it("every claim has evidence that exists", () => {
    for (const claim of CLAIMS) {
      if (claim.source.startsWith("user:")) {
        expect(claim.source, claim.text).toMatch(/^user:\d{4}-\d{2}-\d{2}$/);
        continue;
      }
      expect(
        existsSync(resolve(REPO_ROOT, claim.source)),
        `"${claim.text}" cites a missing file: ${claim.source}`,
      ).toBe(true);
    }
  });

  it("no claim repeats a forbidden phrase", () => {
    for (const claim of CLAIMS) {
      for (const { pattern, why } of FORBIDDEN) {
        expect(pattern.test(claim.text), `"${claim.text}": ${why}`).toBe(false);
      }
    }
  });

  // Enforced since F4 (T4.12), when the legacy landing was replaced.
  it("public-site source files contain no forbidden phrase", () => {
    expect(forbiddenPhrases()).toEqual([]);
  });

  it("the modules map covers every ERP module", () => {
    expect(Object.keys(MODULES).sort()).toEqual([...ERP_MODULES].sort());
  });
});
