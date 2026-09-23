import type { TRPCRouterRecord } from "@trpc/server";

import { publicHealthProcedure } from "../../trpc";

export const healthRouter = {
  ping: publicHealthProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),
} satisfies TRPCRouterRecord;
