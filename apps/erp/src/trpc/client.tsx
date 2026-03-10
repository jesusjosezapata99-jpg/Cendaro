/**
 * Cendaro — tRPC React Client
 *
 * Client-side tRPC hooks powered by TanStack React Query.
 * tRPC v11 uses `createTRPCContext` from @trpc/tanstack-react-query.
 */
"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@cendaro/api";

import { getQueryClient } from "./query-client";
import { getUrl, transformer } from "./shared";

const { TRPCProvider: InternalTRPCProvider, useTRPC } =
  createTRPCContext<AppRouter>();

export { useTRPC };

function makeTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        transformer,
        url: getUrl(),
        headers: () => {
          const headers = new Headers();
          headers.set("x-trpc-source", "nextjs-react");
          return headers;
        },
      }),
    ],
  });
}

export function TRPCProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(makeTRPCClient);

  return (
    <InternalTRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </InternalTRPCProvider>
  );
}
