/**
 * Seeds a throwaway workspace in a real Postgres for the integration suites.
 * Writes are refused unless the database is local: audit_log is immutable, so
 * what these suites create is never cleaned up.
 */
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import type { getDb } from "@cendaro/db/client";
import * as schema from "@cendaro/db/schema";

import { logger } from "../../logger";
import { appRouter } from "../../root";
import { createCallerFactory } from "../../trpc";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const TEST_URL = process.env.TEST_DATABASE_URL;

const createCaller = createCallerFactory(appRouter);

export type TestRole =
  "owner" | "supervisor" | "employee" | "vendor" | "marketing";
type Caller = ReturnType<typeof createCaller>;

export interface RealDb {
  pool: pg.Pool;
  db: ReturnType<typeof getDb>;
}

export interface ProductOptions {
  price?: number;
  cost?: number;
  /** Units in the showroom and in the back warehouse, in priority order. */
  stock?: readonly [number, number];
}

export interface Fixture {
  workspaceId: string;
  showroomId: string;
  warehouseId: string;
  customerId: string;
  userIds: Record<TestRole, string>;
  as: (role: TestRole) => Caller;
  addProduct: (options?: ProductOptions) => Promise<string>;
}

export function isLocalDatabase(): boolean {
  return !!TEST_URL && LOCAL_HOSTS.has(new URL(TEST_URL).hostname);
}

export function openRealDb(): RealDb {
  if (!isLocalDatabase()) {
    throw new Error("Integration writes only run against a local database");
  }
  const pool = new pg.Pool({ connectionString: TEST_URL, max: 12 });
  return { pool, db: drizzle(pool, { schema, casing: "snake_case" }) };
}

async function insertUser(
  pool: pg.Pool,
  workspaceId: string,
  role: TestRole,
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO user_profile (id, email, full_name, username, role)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      id,
      `${role}-${id}@example.invalid`,
      `Test ${role}`,
      `${role}-${id}`,
      role,
    ],
  );
  await pool.query(
    `INSERT INTO workspace_member (workspace_id, user_id, role)
     VALUES ($1, $2, $3)`,
    [workspaceId, id, role],
  );
  return id;
}

async function insertWarehouse(
  pool: pg.Pool,
  workspaceId: string,
  type: "showroom" | "warehouse",
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO warehouse (workspace_id, name, type)
     VALUES ($1, $2, $3) RETURNING id`,
    [workspaceId, `Test ${type}`, type],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("warehouse insert returned nothing");
  return id;
}

export async function seedFixture({ pool, db }: RealDb): Promise<Fixture> {
  const workspaceId = randomUUID();
  await pool.query(
    `INSERT INTO workspace (id, name, slug, plan)
     VALUES ($1, 'Integration', $2, 'enterprise')`,
    [workspaceId, `integration-${workspaceId}`],
  );
  await pool.query(
    `INSERT INTO workspace_module (workspace_id, module)
     SELECT $1, unnest(enum_range(NULL::erp_module))`,
    [workspaceId],
  );

  const userIds: Record<TestRole, string> = {
    owner: await insertUser(pool, workspaceId, "owner"),
    supervisor: await insertUser(pool, workspaceId, "supervisor"),
    employee: await insertUser(pool, workspaceId, "employee"),
    vendor: await insertUser(pool, workspaceId, "vendor"),
    marketing: await insertUser(pool, workspaceId, "marketing"),
  };
  const showroomId = await insertWarehouse(pool, workspaceId, "showroom");
  const warehouseId = await insertWarehouse(pool, workspaceId, "warehouse");

  const customer = await pool.query<{ id: string }>(
    `INSERT INTO customer
       (workspace_id, name, identification, address, credit_limit, credit_days)
     VALUES ($1, 'Cliente Prueba', 'G-20000303-0', 'Av. Urdaneta, Caracas', 1000, 30)
     RETURNING id`,
    [workspaceId],
  );
  const customerId = customer.rows[0]?.id;
  if (!customerId) throw new Error("customer insert returned nothing");

  await pool.query(
    `INSERT INTO exchange_rate (workspace_id, rate_type, rate)
     VALUES ($1, 'bcv', 40)`,
    [workspaceId],
  );

  const as = (role: TestRole): Caller =>
    createCaller({
      user: {
        id: userIds[role],
        email: `${role}@example.invalid`,
        aal: "aal2",
        sessionId: null,
      },
      db,
      requestId: `req-integration-${role}`,
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: `req-integration-${role}` }),
      workspaceId,
    });

  const addProduct = async ({
    price = 10,
    cost = 5,
    stock = [100, 0],
  }: ProductOptions = {}): Promise<string> => {
    const productId = randomUUID();
    await pool.query(
      `INSERT INTO product (id, workspace_id, sku, name, status, cost_avg)
       VALUES ($1, $2, $3, 'Producto Prueba', 'active', $4)`,
      [productId, workspaceId, `SKU-${productId}`, cost],
    );
    await pool.query(
      `INSERT INTO product_price (workspace_id, product_id, price_type, amount_usd)
       VALUES ($1, $2, 'store', $3)`,
      [workspaceId, productId, price],
    );
    await pool.query(
      `INSERT INTO stock_ledger (workspace_id, product_id, warehouse_id, quantity)
       VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)`,
      [workspaceId, productId, showroomId, stock[0], warehouseId, stock[1]],
    );
    return productId;
  };

  return {
    workspaceId,
    showroomId,
    warehouseId,
    customerId,
    userIds,
    as,
    addProduct,
  };
}
