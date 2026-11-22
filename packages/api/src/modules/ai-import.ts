/**
 * Cendaro — Zero-Template AI Import & Semantic Matching Router (`aiImport`)
 *
 * Exposes tenant-isolated endpoints for:
 *   • `listTemplateProfiles`: lists saved supplier/workspace column profiles (READ ONLY RLS).
 *   • `inferTabularSchema`: resolves headers, currency, decimal separator & units formula
 *     via `ImportTemplateProfile` (0ms) -> Multilingual Alias -> Gemini Free-Tier AI.
 *   • `extractDocumentItems`: multimodal PDF / unstructured price-list & manifest extraction.
 *   • `matchCatalogItems`: Hybrid RRF (`exact_sku` + `barcode` + `lexical` + `pgvector` 1536d)
 *     semantic catalog matching across Spanish, English & Mandarin Chinese.
 *   • `saveTemplateProfile`: persists/updates a learned template fingerprint for 0-ms future loads.
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { getDb } from "@cendaro/db/client";
import type { ImportTargetDomain, UserRole } from "@cendaro/validators";
import { ImportTemplateProfile, Supplier } from "@cendaro/db/schema";
import {
  can,
  importTargetDomainSchema,
  saveTemplateProfileInputSchema,
  tabularSchemaInferenceInputSchema,
} from "@cendaro/validators";

import {
  extractItemsFromDocumentWithGemini,
  inferTabularSchema,
  lookupSavedTemplateProfile,
  StructuredAiUnavailableError,
} from "../services/ai";
import { RagGuardrailViolationError } from "../services/rag/guardrails";
import { matchImportedItemsToCatalog } from "../services/rag/product-matcher";
import { assertInWorkspace } from "../services/workspace-guard";
import {
  assertMfaCompliance,
  assertModuleEnabled,
  createTRPCRouter,
  runInWorkspaceRls,
  runInWorkspaceRlsReadonly,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";

function isUndefinedTableError(err: unknown): boolean {
  const code =
    (err as { code?: string } | null)?.code ??
    (err as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "42P01";
}

async function assertDomainPermissionAndModule(
  ctx: {
    db: ReturnType<typeof getDb>;
    workspace: Parameters<typeof assertModuleEnabled>[0]["workspace"];
  },
  domain: ImportTargetDomain | undefined,
): Promise<void> {
  const role: UserRole = ctx.workspace.role;
  if (domain === "inventory") {
    await assertModuleEnabled(ctx, "inventory");
    if (!can(role, "inventory", "update")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Permiso denegado: inventory.update",
      });
    }
  } else if (domain === "packing_list") {
    await assertModuleEnabled(ctx, "containers");
    if (!can(role, "containers", "update")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Permiso denegado: containers.update",
      });
    }
  }
}

export const aiImportRouter = createTRPCRouter({
  /**
   * Lists saved Zero-Template profiles in the active workspace (`READ ONLY` RLS).
   */
  listTemplateProfiles: wsReadPermissionProcedure("catalog", "create")
    .input(
      z.object({
        targetDomain: importTargetDomainSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.targetDomain) {
        await assertDomainPermissionAndModule(ctx, input.targetDomain);
      }
      try {
        return await ctx.db
          .select({
            id: ImportTemplateProfile.id,
            targetDomain: ImportTemplateProfile.targetDomain,
            profileName: ImportTemplateProfile.profileName,
            supplierId: ImportTemplateProfile.supplierId,
            headerFingerprint: ImportTemplateProfile.headerFingerprint,
            sampleHeaders: ImportTemplateProfile.sampleHeaders,
            columnMapping: ImportTemplateProfile.columnMapping,
            transformRules: ImportTemplateProfile.transformRules,
            hitCount: ImportTemplateProfile.hitCount,
            updatedAt: ImportTemplateProfile.updatedAt,
          })
          .from(ImportTemplateProfile)
          .where(
            and(
              eq(ImportTemplateProfile.workspaceId, ctx.workspace.workspaceId),
              input.targetDomain
                ? eq(ImportTemplateProfile.targetDomain, input.targetDomain)
                : undefined,
            ),
          )
          .orderBy(desc(ImportTemplateProfile.hitCount))
          .limit(100);
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return [];
        }
        throw err;
      }
    }),

  /**
   * Infers column mappings & transformation rules from top spreadsheet rows.
   * Built on `wsReadPermissionProcedure` so external Gemini calls execute OUTSIDE
   * any Supavisor `:6543` transaction.
   */
  inferTabularSchema: wsReadPermissionProcedure("catalog", "create")
    .input(tabularSchemaInferenceInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertDomainPermissionAndModule(ctx, input.targetDomain);

      // 1. Short READ ONLY lookup of saved tenant/supplier profile
      const savedProfile = await runInWorkspaceRlsReadonly(
        ctx.db,
        ctx.workspace.workspaceId,
        (tx) =>
          lookupSavedTemplateProfile(
            tx,
            ctx.workspace.workspaceId,
            input.targetDomain,
            input.sampleRows,
            input.supplierId,
          ),
      );

      // 2. Schema resolution OUTSIDE DB transaction
      const inferred = await inferTabularSchema({
        workspaceId: ctx.workspace.workspaceId,
        userId: ctx.user.id,
        input,
        savedProfile,
        poolDb: ctx.db,
      });

      // 3. Best-effort hit counter increment when a saved profile matched
      if (savedProfile) {
        try {
          await runInWorkspaceRls(ctx.db, ctx.workspace.workspaceId, (tx) =>
            tx
              .update(ImportTemplateProfile)
              .set({
                hitCount: sql`${ImportTemplateProfile.hitCount} + 1`,
                updatedAt: sql`now()`,
              })
              .where(
                and(
                  eq(ImportTemplateProfile.id, savedProfile.profileId),
                  eq(
                    ImportTemplateProfile.workspaceId,
                    ctx.workspace.workspaceId,
                  ),
                ),
              ),
          );
        } catch {
          // Non-fatal metric update
        }
      }

      return inferred;
    }),

  /**
   * Extracts structured line items from a PDF or unstructured document via Gemini Free Tier.
   */
  extractDocumentItems: wsReadPermissionProcedure("catalog", "create")
    .input(
      z.object({
        targetDomain: importTargetDomainSchema,
        filename: z.string().min(1).max(256),
        extractedText: z.string().max(120_000).optional(),
        pdfBase64: z.string().max(11_000_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertDomainPermissionAndModule(ctx, input.targetDomain);
      if (!input.extractedText?.trim() && !input.pdfBase64?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Se requiere texto extraído o el contenido PDF para procesar el documento",
        });
      }

      try {
        return await extractItemsFromDocumentWithGemini({
          workspaceId: ctx.workspace.workspaceId,
          userId: ctx.user.id,
          filename: input.filename,
          targetDomain: input.targetDomain,
          extractedText: input.extractedText,
          pdfBase64: input.pdfBase64,
          poolDb: ctx.db,
        });
      } catch (err) {
        if (err instanceof RagGuardrailViolationError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message,
          });
        }
        if (err instanceof StructuredAiUnavailableError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: err.message,
          });
        }
        throw err;
      }
    }),

  /**
   * Matches imported rows against the workspace catalog using Hybrid RRF
   * (`exact_sku` + `barcode` + `lexical` + `pgvector` 1,536-dim cosine similarity).
   */
  matchCatalogItems: wsReadPermissionProcedure("catalog", "create")
    .input(
      z.object({
        targetDomain: importTargetDomainSchema.default("catalog"),
        items: z
          .array(
            z.object({
              sku: z.string().max(64).optional(),
              skuAutoGenerated: z.boolean().optional(),
              name: z.string().min(1).max(512),
              nameOriginal: z.string().max(512).optional(),
              barcode: z.string().max(128).optional(),
              categoryRaw: z.string().max(256).optional(),
              brandRaw: z.string().max(256).optional(),
            }),
          )
          .min(1)
          .max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertDomainPermissionAndModule(ctx, input.targetDomain);
      return matchImportedItemsToCatalog(
        ctx.db,
        ctx.workspace.workspaceId,
        input.items,
      );
    }),

  /**
   * Saves or updates a learned template fingerprint in `public.import_template_profile`
   * so subsequent uploads from the same supplier/format map in `0 ms` with `0` tokens.
   */
  saveTemplateProfile: wsPermissionProcedure("catalog", "create")
    .input(saveTemplateProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertMfaCompliance(ctx.user);
      await assertDomainPermissionAndModule(ctx, input.targetDomain);

      if (input.supplierId) {
        await assertInWorkspace(
          ctx.db,
          Supplier,
          input.supplierId,
          ctx.workspace.workspaceId,
          "Proveedor",
        );
      }

      try {
        const [saved] = await ctx.db
          .insert(ImportTemplateProfile)
          .values({
            workspaceId: ctx.workspace.workspaceId,
            supplierId: input.supplierId ?? null,
            targetDomain: input.targetDomain,
            profileName: input.profileName,
            headerFingerprint: input.headerFingerprint,
            sampleHeaders: input.sampleHeaders,
            columnMapping: input.columnMapping,
            transformRules: input.transformRules ?? {},
            hitCount: 1,
            createdBy: ctx.user.id,
          })
          .onConflictDoUpdate({
            target: [
              ImportTemplateProfile.workspaceId,
              ImportTemplateProfile.targetDomain,
              ImportTemplateProfile.headerFingerprint,
            ],
            set: {
              profileName: input.profileName,
              supplierId: input.supplierId ?? null,
              sampleHeaders: input.sampleHeaders,
              columnMapping: input.columnMapping,
              transformRules: input.transformRules ?? {},
              hitCount: sql`${ImportTemplateProfile.hitCount} + 1`,
              updatedAt: sql`now()`,
            },
          })
          .returning({
            id: ImportTemplateProfile.id,
            profileName: ImportTemplateProfile.profileName,
            hitCount: ImportTemplateProfile.hitCount,
          });

        return { saved: true, profile: saved ?? null };
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return { saved: false, profile: null };
        }
        throw err;
      }
    }),
});
