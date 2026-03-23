import { approvalsRouter } from "./modules/approvals";
import { auditRouter } from "./modules/audit-router";
import { catalogRouter } from "./modules/catalog";
import { catalogImportRouter } from "./modules/catalog-import";
import { containerRouter } from "./modules/containers";
import { dashboardRouter } from "./modules/dashboard";
import { healthRouter } from "./modules/health/router";
import { integrationsRouter } from "./modules/integrations";
import { inventoryRouter } from "./modules/inventory";
import { inventoryImportRouter } from "./modules/inventory-import";
import { paymentsRouter } from "./modules/payments";
import { pricingRouter } from "./modules/pricing";
import { quotesRouter } from "./modules/quotes";
import { receivablesRouter } from "./modules/receivables";
import { reportingRouter } from "./modules/reporting";
import { salesRouter } from "./modules/sales";
import { usersRouter } from "./modules/users";
import { vendorRouter } from "./modules/vendors";
import { workspaceRouter } from "./modules/workspace";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  audit: auditRouter,
  approvals: approvalsRouter,
  catalog: catalogRouter,
  catalogImport: catalogImportRouter,
  inventory: inventoryRouter,
  inventoryImport: inventoryImportRouter,
  container: containerRouter,
  pricing: pricingRouter,
  quotes: quotesRouter,
  sales: salesRouter,
  payments: paymentsRouter,
  receivables: receivablesRouter,
  reporting: reportingRouter,
  vendor: vendorRouter,
  integrations: integrationsRouter,
  dashboard: dashboardRouter,
  health: healthRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
