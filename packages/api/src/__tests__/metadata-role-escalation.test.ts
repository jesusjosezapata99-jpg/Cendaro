/**
 * C1 guard (PLAN-2026-09-SECURITY-REMEDIATION, phase F1).
 *
 * Supabase lets every signed-in user rewrite their own `user_metadata`
 * (`supabase.auth.updateUser({ data: { role: "owner" } })`), and those values
 * end up in the JWT. Any authorization or audit decision based on it is
 * attacker-controlled. Roles must come from `workspace_member` via
 * `is_workspace_member()`.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { WorkspaceActor } from "../trpc";
import { logger } from "../logger";
import { buildAuditIntegrityMetadata, logAudit } from "../modules/audit";
import * as trpc from "../trpc";
import {
  createCallerFactory,
  createTRPCRouter,
  mapClaimsToUser,
  workspaceReadProcedure,
} from "../trpc";

const API_SRC = fileURLToPath(new URL("../", import.meta.url));
const ERP_API_ROUTES = fileURLToPath(
  new URL("../../../../apps/erp/src/app/api/", import.meta.url),
);

/** Property reads such as `x.user_metadata`, `x?.user_metadata`, `["user_metadata"]`. */
const METADATA_READ = /(\??\.user_metadata\b|\[\s*["']user_metadata["']\s*\])/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

function metadataReads(dir: string): string[] {
  return sourceFiles(dir).flatMap((file) =>
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line, i) =>
        METADATA_READ.test(line)
          ? [`${relative(dir, file)}:${i + 1}: ${line.trim()}`]
          : [],
      ),
  );
}

describe("C1 static guard: no authorization from user_metadata", () => {
  it("scans both the API package and the ERP route handlers", () => {
    expect(sourceFiles(API_SRC).length).toBeGreaterThan(10);
    expect(sourceFiles(ERP_API_ROUTES).length).toBeGreaterThan(3);
  });

  it("never reads user_metadata in packages/api", () => {
    expect(metadataReads(API_SRC)).toEqual([]);
  });

  it("never reads user_metadata in apps/erp route handlers", () => {
    expect(metadataReads(ERP_API_ROUTES)).toEqual([]);
  });

  it("does not export the removed metadata-based procedures", () => {
    const exported = Object.keys(trpc);
    expect(exported).not.toContain("roleRestrictedProcedure");
    expect(exported).not.toContain("permissionProcedure");
    expect(exported).not.toContain("orgAdminProcedure");
  });
});

describe("mapClaimsToUser", () => {
  it("drops user_metadata (including a forged role) from verified claims", () => {
    const user = mapClaimsToUser({
      sub: "a0000000-0000-0000-0000-00000000c1a1",
      email: "attacker@example.com",
      aal: "aal1",
      user_metadata: { role: "owner", full_name: "Real Owner" },
    });

    expect(user).toEqual({
      id: "a0000000-0000-0000-0000-00000000c1a1",
      email: "attacker@example.com",
      aal: "aal1",
    });
  });

  it("keeps only valid assurance levels", () => {
    expect(mapClaimsToUser({ sub: "x", aal: "aal2" })?.aal).toBe("aal2");
    expect(mapClaimsToUser({ sub: "x", aal: "aal9" })?.aal).toBeNull();
  });

  it("returns null without a subject", () => {
    expect(mapClaimsToUser({ email: "x@example.com" })).toBeNull();
    expect(mapClaimsToUser(null)).toBeNull();
  });
});

type Row = Record<string, unknown>;

/**
 * Minimal Drizzle stand-in for resolveWorkspaceMembership: `execute` answers
 * is_workspace_member(); `select().from(table)...limit()` answers by shape.
 */
function fakeMembershipDb(opts: {
  memberRole: string;
  plan: string;
  fullName: string;
}) {
  return {
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: "m0000000-0000-0000-0000-000000000001",
            member_role: opts.memberRole,
            member_status: "active",
          },
        ],
      }),
    select: (shape: Row) => {
      const rows =
        "plan" in shape ? [{ plan: opts.plan }] : [{ fullName: opts.fullName }];
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(rows),
      };
      return chain;
    },
  };
}

describe("C1 behavior: workspace role comes from the database", () => {
  const router = createTRPCRouter({
    whoAmI: workspaceReadProcedure.query(({ ctx }) => ({
      workspaceRole: ctx.user.workspaceRole,
      displayName: ctx.user.displayName,
      membershipRole: ctx.workspace.role,
    })),
  });
  const createCaller = createCallerFactory(router);

  it("ignores a forged owner role in the token and uses workspace_member.role", async () => {
    // A token whose user_metadata was edited by the user. It must have no
    // effect: the context type no longer carries metadata at all.
    const forgedUser = {
      id: "a0000000-0000-0000-0000-00000000c1b2",
      email: "employee@example.com",
      user_metadata: { role: "owner" },
    };

    const caller = createCaller({
      user: forgedUser,
      db: fakeMembershipDb({
        memberRole: "employee",
        plan: "pro",
        fullName: "Empleado Real",
      }) as never,
      requestId: "req-c1",
      log: logger.child({ requestId: "req-c1" }),
      workspaceId: "b0000000-0000-0000-0000-000000000001",
    });

    await expect(caller.whoAmI()).resolves.toEqual({
      workspaceRole: "employee",
      displayName: "Empleado Real",
      membershipRole: "employee",
    });
  });
});

describe("C1 behavior: audit actor cannot be spoofed", () => {
  function captureInsert() {
    const inserted: Row[] = [];
    const db = {
      insert: () => ({
        values: (row: Row) => {
          inserted.push(row);
          return Promise.resolve();
        },
      }),
    };
    return { db, inserted };
  }

  it("records the DB-verified workspace role and profile name", async () => {
    const { db, inserted } = captureInsert();
    const actor: WorkspaceActor = {
      id: "a0000000-0000-0000-0000-00000000c1c3",
      email: "employee@example.com",
      workspaceRole: "employee",
      displayName: "Empleado Real",
    };

    await logAudit(db as never, actor, {
      workspaceId: "b0000000-0000-0000-0000-000000000001",
      action: "test.action",
      entity: "test",
    });

    expect(inserted[0]).toMatchObject({
      actorRole: "employee",
      actorName: "Empleado Real",
    });
  });

  it("never trusts user_metadata on a non-workspace actor", async () => {
    const { db, inserted } = captureInsert();
    const spoofed = {
      id: "a0000000-0000-0000-0000-00000000c1c4",
      email: "employee@example.com",
      user_metadata: { role: "owner", full_name: "Real Owner" },
    };

    await logAudit(db as never, spoofed, {
      action: "test.action",
      entity: "test",
    });

    expect(inserted[0]).toMatchObject({
      actorRole: null,
      actorName: "employee@example.com",
    });
  });

  it("keeps the audit integrity hash format", async () => {
    const { db, inserted } = captureInsert();
    await logAudit(db as never, null, {
      action: "test.action",
      entity: "test",
    });

    expect(inserted[0]?.metadata).toMatchObject({
      _hashAlgorithm: "sha256",
      _integrityHash: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
    });
  });

  it("hashes exactly like the pre-F1 inline implementation (golden)", async () => {
    const entry = {
      workspaceId: "b0000000-0000-0000-0000-000000000001",
      action: "order.create",
      entity: "sales_order",
      entityId: "c0000000-0000-0000-0000-000000000001",
      oldValue: null,
      newValue: { total: 1500 },
      metadata: { source: "golden" },
      correlationId: "d0000000-0000-0000-0000-000000000001",
    };
    const actorId = "a0000000-0000-0000-0000-00000000c1c5";

    // Verbatim payload shape and key order of the removed inline code.
    const expectedHash = createHash("sha256")
      .update(
        JSON.stringify({
          workspaceId: entry.workspaceId,
          actorId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
        }),
      )
      .digest("hex");

    expect(
      buildAuditIntegrityMetadata({ ...entry, actorId }, entry.metadata),
    ).toEqual({
      source: "golden",
      _integrityHash: expectedHash,
      _hashAlgorithm: "sha256",
    });

    const { db, inserted } = captureInsert();
    await logAudit(db as never, { id: actorId, email: "x@example.com" }, entry);
    expect(inserted[0]?.metadata).toEqual({
      source: "golden",
      _integrityHash: expectedHash,
      _hashAlgorithm: "sha256",
    });
  });
});
