// Re-export a ready-to-use caller factory bound to the appRouter
import { appRouter } from "./root";
import { createCallerFactory } from "./trpc";

export type { AppRouter } from "./root";
export { appRouter } from "./root";
export { createTRPCContext, createCallerFactory } from "./trpc";
export { logger } from "./logger";
export type { ILogger, LogContext } from "./logger";

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
