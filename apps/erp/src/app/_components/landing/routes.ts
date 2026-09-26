/**
 * Public marketing routes (PLAN-2026-09-LANDING-REDESIGN §4.1). Single source
 * for the sitemap and internal navigation; add a page here when it ships,
 * never before (the sitemap must not list a 404).
 */
export interface MarketingRoute {
  path: string;
  /** Relative sitemap priority. */
  priority: number;
}

export const MARKETING_ROUTES: readonly MarketingRoute[] = [
  { path: "/", priority: 1 },
  { path: "/funciones", priority: 0.8 },
  { path: "/funciones/inventario", priority: 0.7 },
  { path: "/funciones/importaciones", priority: 0.7 },
  { path: "/funciones/finanzas", priority: 0.7 },
];
