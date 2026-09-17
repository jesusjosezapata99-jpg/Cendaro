// Re-export a ready-to-use caller factory bound to the appRouter
import { appRouter } from "./root";
import { createCallerFactory } from "./trpc";

export type { AppRouter } from "./root";
export { appRouter } from "./root";
export {
  createTRPCContext,
  createCallerFactory,
  isValidUuid,
  mapClaimsToUser,
} from "./trpc";
export type { AuthenticatedUser } from "./trpc";
export { buildAuditIntegrityMetadata } from "./modules/audit";
export { logger } from "./logger";
export type { ILogger, LogContext } from "./logger";

// Dashboard overview (PLAN-2026-09-DESIGN-SYSTEM §T3.1)
export type { DashboardOverview, DashboardPeriod } from "./modules/dashboard";

// Inventory Import types (PRD §10, §23)
export type {
  ImportMode,
  ImportResult,
  InitializeCommitInput,
  InitializeResult,
  InitializeRow,
  InventoryImportCommit,
  InventoryImportRow,
  ValidatedRow,
} from "./modules/inventory-import";

export const createCaller = createCallerFactory(appRouter);
