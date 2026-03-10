import { auditRouter } from "./modules/audit-router";
import { catalogRouter } from "./modules/catalog";
import { containerRouter } from "./modules/containers";
import { dashboardRouter } from "./modules/dashboard";
import { healthRouter } from "./modules/health/router";
import { integrationsRouter } from "./modules/integrations";
import { inventoryRouter } from "./modules/inventory";
import { pricingRouter } from "./modules/pricing";
import { salesRouter } from "./modules/sales";
import { usersRouter } from "./modules/users";
import { vendorRouter } from "./modules/vendors";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  audit: auditRouter,
  catalog: catalogRouter,
  inventory: inventoryRouter,
  container: containerRouter,
  pricing: pricingRouter,
  sales: salesRouter,
  vendor: vendorRouter,
  integrations: integrationsRouter,
  dashboard: dashboardRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
