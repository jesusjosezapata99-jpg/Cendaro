/**
 * Dynamic llms.txt and llms-full.txt builders (PLAN-2026-10-MAESTRO-SEO-GEO-AI-MARKETING §5.1).
 *
 * Compiles verified product facts from `content.ts` and `features.ts` into
 * clean Markdown following the llmstxt.org v2 specification so AI search
 * crawlers (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Google-Extended)
 * and LLM agents can ingest Cendaro's exact capabilities without HTML noise.
 */
import { ERP_MODULES } from "@cendaro/validators";

import {
  BEFORE_AFTER,
  FACTS,
  FAQ,
  HERO,
  MODULE_GROUPS,
  MODULES,
  OFFER,
  PLANS,
  SECURITY,
  STEPS,
} from "./content";
import {
  FEATURE_SLUGS,
  featureHref,
  FEATURES,
  MODULE_FEATURE,
} from "./features";

/** Concise Markdown index at `/llms.txt` following llmstxt.org v2. */
export function buildLlmsTxt(origin: URL): string {
  const abs = (path: string): string => new URL(path, origin).href;

  const featureLinks = FEATURE_SLUGS.map((slug) => {
    const page = FEATURES[slug];
    return `- [${page.name}](${abs(featureHref(slug))}): ${page.metaDescription}`;
  }).join("\n");

  const moduleLines = ERP_MODULES.map((id) => {
    const mod = MODULES[id];
    return `- **${mod.name}** (${mod.group}): ${mod.line}.`;
  }).join("\n");

  return [
    "# Cendaro",
    "",
    `> ${HERO.title.join(" ")}. ${HERO.lead}`,
    "",
    "Cendaro es un sistema ERP omnicanal en la nube diseñado para distribuidoras, importadoras y comercios en Venezuela. Centraliza catálogo, inventario por almacén, importación de contenedores con lectura de packing lists por inteligencia artificial, punto de venta con datos fiscales (RIF y cédula), pedidos, vendedores con comisiones, sincronización diaria de la tasa del Banco Central de Venezuela (BCV), cuentas por cobrar y cierre de caja en dólares y bolívares.",
    "",
    "## Datos clave verificables",
    "",
    `- **Módulos integrados**: ${FACTS.modules} módulos en un solo sistema.`,
    `- **Control de acceso**: ${FACTS.roles} roles con permisos por módulo y por acción verificados en el servidor.`,
    `- **Operación bimoneda (USD y Bs)**: Precios en dólares y cobros en bolívares con sincronización diaria de la tasa BCV (6:00 p. m., hora de Venezuela) y retención preventiva cuando la tasa varía más de ${FACTS.rateHoldPct}.`,
    "- **Importaciones con IA**: Lectura de packing lists en Excel (.xlsx, .xls) y PDF, incluyendo fotos incrustadas en el Excel, con emparejamiento frente al catálogo.",
    "- **Activación**: Diagnóstico de 30 minutos y migración asistida desde archivos Excel en los planes Pro y Empresa.",
    "",
    "## Páginas principales y documentación",
    "",
    `- [Inicio — Cendaro ERP](${abs("/")}): Visión general del sistema, flujo operativo de 4 pasos, planes y preguntas frecuentes.`,
    `- [Índice de los ${FACTS.modules} módulos](${abs("/funciones")}): Catálogo completo de funciones agrupadas por Operación, Ventas, Finanzas, Canales y Control.`,
    featureLinks,
    `- [Documentación completa para IA (llms-full.txt)](${abs("/llms-full.txt")}): Contenido íntegro de los ${FACTS.modules} módulos, flujos paso a paso, seguridad, planes y preguntas frecuentes en un solo archivo Markdown.`,
    "",
    `## Los ${FACTS.modules} módulos de Cendaro`,
    "",
    moduleLines,
    "",
  ].join("\n");
}

/** Complete single-file Markdown knowledge base at `/llms-full.txt`. */
export function buildLlmsFullTxt(origin: URL): string {
  const abs = (path: string): string => new URL(path, origin).href;

  const stepsSection = STEPS.map(
    (s) =>
      `### ${s.index}. ${s.title}\n${s.body}\n${s.bullets.map((b) => `- ${b}`).join("\n")}`,
  ).join("\n\n");

  const groupsSection = MODULE_GROUPS.map((group) => {
    const items = ERP_MODULES.map((id) => MODULES[id]).filter(
      (m) => m.group === group,
    );
    return [
      `### ${group}`,
      ...items.map((m) => `- **${m.name}**: ${m.line}.`),
    ].join("\n");
  }).join("\n\n");

  const modulesTable = [
    "| Módulo | Área | Qué resuelve en la operación | Documentación |",
    "| :--- | :--- | :--- | :--- |",
    ...ERP_MODULES.map((id) => {
      const m = MODULES[id];
      const slug = MODULE_FEATURE[id];
      const link = slug ? abs(featureHref(slug)) : abs(`/funciones#${id}`);
      return `| **${m.name}** | ${m.group} | ${m.line} | ${link} |`;
    }),
  ].join("\n");

  const featuresSection = FEATURE_SLUGS.map((slug) => {
    const page = FEATURES[slug];
    const steps = page.steps
      .map((s, idx) => `${idx + 1}. **${s.title}**: ${s.text}`)
      .join("\n");
    const caps = page.capabilities.map((c) => `- ${c.text}`).join("\n");
    const faqs = page.faq.map((f) => `- **${f.q}**\n  ${f.a}`).join("\n");

    return [
      `## ${page.name} (${abs(featureHref(slug))})`,
      "",
      `> ${page.title}. ${page.lead}`,
      "",
      "### Cómo se hace paso a paso",
      steps,
      "",
      `### ${page.difference.title}`,
      page.difference.body,
      "",
      "### Capacidades incluidas",
      caps,
      "",
      "### Preguntas frecuentes del módulo",
      faqs,
    ].join("\n");
  }).join("\n\n---\n\n");

  const beforeAfterSection = BEFORE_AFTER.map(
    (row) => `- **Antes**: ${row.before}\n  **Con Cendaro**: ${row.after}`,
  ).join("\n");

  const securitySection = SECURITY.map((s) => `- ${s.text}`).join("\n");

  const plansSection = PLANS.map(
    (p) =>
      `### Plan ${p.name}${p.recommended ? " (Recomendado)" : ""}\n- **Perfil**: ${p.audience}\n- **Incluye**: ${p.highlights.join(" · ")}\n- **Puesta en marcha**: ${p.onboarding}`,
  ).join("\n\n");

  const offerSection = OFFER.map((o) => `- **${o.title}**: ${o.body}`).join(
    "\n",
  );

  const faqSection = FAQ.map((item) => `### ${item.q}\n${item.a}`).join("\n\n");

  return [
    "# Cendaro — Documentación Completa del Producto (llms-full.txt)",
    "",
    `> ${HERO.title.join(" ")}. ${HERO.lead}`,
    "",
    `- **Sitio oficial**: ${abs("/")}`,
    `- **Índice de funciones**: ${abs("/funciones")}`,
    `- **Resumen compacto para IA**: ${abs("/llms.txt")}`,
    "- **Mercado principal**: Venezuela (operación bimoneda USD y bolívares con tasa BCV, validación de RIF y cédula, IVA e IGTF).",
    "",
    "---",
    "",
    "## Flujo operativo principal de una distribuidora en Cendaro",
    "",
    stepsSection,
    "",
    "---",
    "",
    `## Los ${FACTS.modules} módulos por área`,
    "",
    modulesTable,
    "",
    groupsSection,
    "",
    "---",
    "",
    featuresSection,
    "",
    "---",
    "",
    "## Comparativa operativa: Antes vs. Con Cendaro",
    "",
    beforeAfterSection,
    "",
    "---",
    "",
    "## Seguridad, control de acceso y auditoría",
    "",
    securitySection,
    "",
    "---",
    "",
    "## Planes y puesta en marcha",
    "",
    plansSection,
    "",
    "### Condiciones de acompañamiento",
    "",
    offerSection,
    "",
    "---",
    "",
    "## Preguntas frecuentes generales",
    "",
    faqSection,
    "",
  ].join("\n");
}
