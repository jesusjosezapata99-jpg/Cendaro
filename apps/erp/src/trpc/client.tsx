/**
 * Cendaro — tRPC React Client
 *
 * Client-side tRPC hooks powered by TanStack React Query.
 * tRPC v11 uses `createTRPCContext` from @trpc/tanstack-react-query.
 */
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  TRPCClientError,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@cendaro/api";
import { transformer, getUrl } from "./shared";

const { TRPCProvider: InternalTRPCProvider, useTRPC } =
  createTRPCContext<AppRouter>();

export { useTRPC };

/**
 * Determines whether a failed query should be retried.
 * Auth errors (UNAUTHORIZED) should never retry — the user needs to re-login.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    const data = error.data as { code?: string } | undefined;
    const code = data?.code;
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return false;
  }
  return failureCount < 2;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,        // 5 min — ERP data rarely changes every second
        gcTime: 10 * 60 * 1000,           // 10 min — keep inactive cache longer
        refetchOnWindowFocus: false,       // prevent noisy refetches
        refetchOnReconnect: true,          // refetch when connection restores
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  return (browserQueryClient ??= makeQueryClient());
}

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
