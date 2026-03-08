import type { TRPCRouterRecord } from "@trpc/server";

import { publicProcedure } from "../../trpc";

export const healthRouter = {
  ping: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),
} satisfies TRPCRouterRecord;
