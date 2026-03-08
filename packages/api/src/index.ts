export type { AppRouter } from "./root";
export { appRouter } from "./root";
export { createTRPCContext, createCallerFactory } from "./trpc";
export { logger } from "./logger";
export type { ILogger, LogContext } from "./logger";

// Re-export a ready-to-use caller factory bound to the appRouter
import { appRouter } from "./root";
import { createCallerFactory } from "./trpc";
export const createCaller = createCallerFactory(appRouter);
