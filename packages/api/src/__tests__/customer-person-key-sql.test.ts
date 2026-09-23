/**
 * customer.person_key is a generated column (migration 014): Postgres rejects
 * any INSERT or UPDATE that writes it. These tests pin the SQL Drizzle emits
 * with the production client settings (casing: "snake_case", client.ts).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";

import { Customer } from "@cendaro/db/schema";

const db = drizzle.mock({ casing: "snake_case" });

describe("customer.person_key generated column", () => {
  it("is never written by an insert", () => {
    const { sql } = db
      .insert(Customer)
      .values({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "Cliente",
        identification: "V-12345678",
      })
      .toSQL();
    expect(sql).toContain('"identification"');
    expect(sql).not.toContain("person_key");
  });

  it("is never written by an update", () => {
    const { sql } = db
      .update(Customer)
      .set({ name: "Cliente", identification: "V-12345678" })
      .where(eq(Customer.id, "00000000-0000-4000-8000-000000000002"))
      .toSQL();
    expect(sql).not.toContain("person_key");
  });

  it("is queried as person_key by the duplicate lookup", () => {
    const { sql } = db
      .select({ id: Customer.id })
      .from(Customer)
      .where(eq(Customer.personKey, "V-12345678"))
      .toSQL();
    expect(sql).toContain('"customer"."person_key" = $1');
  });
});
