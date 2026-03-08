import { createTRPCRouter } from "./trpc";
import { usersRouter } from "./modules/users";
import { auditRouter } from "./modules/audit-router";
import { catalogRouter } from "./modules/catalog";
import { inventoryRouter } from "./modules/inventory";
import { containerRouter } from "./modules/containers";
import { pricingRouter } from "./modules/pricing";
import { salesRouter } from "./modules/sales";
import { vendorRouter } from "./modules/vendors";
import { integrationsRouter } from "./modules/integrations";
import { dashboardRouter } from "./modules/dashboard";
import { healthRouter } from "./modules/health/router";

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
