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
export type { AuthAssuranceLevel, AuthenticatedUser } from "./trpc";
export { MfaRequiredError } from "./trpc";
export {
  MFA_ENFORCED_ROLES,
  MFA_ENFORCEMENT_DATE,
  mfaComplianceFor,
} from "./services/mfa-enforcement";
export type { MfaCompliance } from "./services/mfa-enforcement";
export { buildAuditIntegrityMetadata } from "./modules/audit";

// Exchange rates (PLAN-2026-09-SECURITY-REMEDIATION F4.1): server-side
// upstream fetch for the public rate routes and the scheduled sync.
export { getUsdCnyRate, getVesRates } from "./services/exchange-rate-sources";
export type { UpstreamRate, VesRates } from "./services/exchange-rate-sources";
export { runScheduledRateSync } from "./modules/rate-sync";
export type {
  HeldRate,
  RateSyncResult,
  ScheduledRateSyncSummary,
} from "./modules/rate-sync";
export type { SyncRatesResult } from "./modules/pricing";
export {
  getRateLimitStore,
  MemoryRateLimitStore,
  PostgresRateLimitStore,
  setRateLimitStore,
  withFallback,
} from "./services/rate-limit";
export type {
  RateLimitResult,
  RateLimitRule,
  RateLimitStore,
} from "./services/rate-limit";
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
