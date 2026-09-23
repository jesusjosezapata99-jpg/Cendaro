/**
 * Cendaro — Vendor row scoping (PLAN-2026-09-SECURITY-REMEDIATION F2).
 *
 * The authorization matrix lets vendors read orders, quotes and customers,
 * but a vendor may only see their own: orders and quotes they created, and
 * customers assigned to them (the same rule as vendor.myOrders and
 * vendor.myCustomers). Every procedure that serves those rows to a vendor,
 * including global search, must apply these helpers.
 */
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import { Customer } from "@cendaro/db/schema";

import type { WorkspaceMembership } from "../trpc";

interface ScopeContext {
  user: { id: string };
  workspace: WorkspaceMembership;
}

/** The caller's user id when rows must be scoped to a vendor, otherwise null. */
export function vendorScopeId(ctx: ScopeContext): string | null {
  return ctx.workspace.role === "vendor" ? ctx.user.id : null;
}

/**
 * Vendors may only sell to customers assigned to them. Other roles, and
 * orders without a customer, pass through unchanged.
 */
export async function assertVendorCustomer(
  ctx: ScopeContext & { db: ReturnType<typeof getDb> },
  customerId: string | null | undefined,
): Promise<void> {
  const vendorId = vendorScopeId(ctx);
  if (!vendorId || !customerId) return;

  const [customer] = await ctx.db
    .select({ id: Customer.id })
    .from(Customer)
    .where(
      and(
        eq(Customer.id, customerId),
        eq(Customer.workspaceId, ctx.workspace.workspaceId),
        eq(Customer.assignedVendorId, vendorId),
      ),
    )
    .limit(1);

  if (!customer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cliente no encontrado",
    });
  }
}
