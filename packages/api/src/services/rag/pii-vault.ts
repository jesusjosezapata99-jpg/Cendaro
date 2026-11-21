/**
 * Cendaro — Cryptographic PII Vault & Dual-Tokenization Service
 *
 * Implements:
 *   1. Per-workspace HKDF key derivation (RFC 5869) from dedicated master root secret
 *      with domain separation between encryption (`cendaro-rag-pii-vault-v1`) and
 *      HMAC tokenization (`cendaro-rag-pii-hmac-v1`).
 *   2. Authenticated encryption/decryption via AES-256-GCM (12-byte IV, explicit
 *      16-byte authentication tag length enforcement — prevents tag-truncation forgery).
 *   3. Dual surrogate token generation:
 *      - Deterministic secret-keyed HMAC tokens for fiscal and banking IDs (<PII_RIF_${hmac}>).
 *      - Ephemeral UUID tokens for commercial costs and margins (<CONF_COST_${uuid}>).
 *   4. Document-scoped & batched role-gated re-hydration:
 *      - Authorized roles ('owner', 'admin', 'supervisor') receive decrypted cleartext
 *        strictly bound to `(workspace_id, document_id)`.
 *      - Unauthorized roles ('employee', 'vendor', 'marketing') receive safe masked labels.
 */

import * as crypto from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";

import { ragPiiVault } from "@cendaro/db/schema";

import { scanOutputDLP } from "./guardrails";
import { detectPiiEntities } from "./pii-detector";

const DEV_FALLBACK_MASTER_KEY =
  "cendaro-master-root-secret-for-rag-pii-vault-2026-hardening";

/** Exported for non-production test harnesses; production resolves dynamically via `resolveMasterRootKey()`. */
export const MASTER_ROOT_KEY = DEV_FALLBACK_MASTER_KEY;

const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

const MANAGEMENT_ROLES: ReadonlySet<string> = new Set([
  "owner",
  "admin",
  "supervisor",
]);

const SURROGATE_TOKEN_REGEX = /<(PII_[A-Z]+|CONF_[A-Z]+)_[a-f0-9-]+>/g;
const FORGED_INPUT_SURROGATE_REGEX =
  /<(?:PII_[A-Z]+|CONF_[A-Z]+)_[a-f0-9-]+>/gi;

export interface VaultRecord {
  id: string;
  workspaceId: string;
  documentId: string;
  surrogateToken: string;
  entityType: string;
  encryptedValue: string;
  cleartextValue?: string;
  iv: string;
  authTag: string;
  buffer?: Buffer;
  keyFingerprint?: string;
  createdAt: Date;
}

export type PiiVaultEntry = VaultRecord;

export interface PiiTokenizationResult {
  sanitizedContent: string;
  vaultEntries: VaultRecord[];
}

/**
 * Resolves the root master secret dynamically per call, enforcing non-empty
 * >= 32-char `PII_VAULT_MASTER_KEY` in production without coupling to `SUPABASE_SERVICE_ROLE_KEY`.
 */
function resolveMasterRootKey(): string {
  const configured = process.env.PII_VAULT_MASTER_KEY?.trim();
  if (configured && configured.length >= 32) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PII_VAULT_MASTER_KEY (>= 32 caracteres) es obligatoria en producción para la bóveda RAG PII",
    );
  }
  return configured && configured.length > 0
    ? configured
    : DEV_FALLBACK_MASTER_KEY;
}

/**
 * Derives a unique 256-bit (32-byte) AES-256-GCM encryption key per workspace via HKDF-SHA256 (RFC 5869).
 */
export function deriveWorkspaceKey(workspaceId: string): Buffer {
  if (!workspaceId || workspaceId.trim().length === 0) {
    throw new Error(
      "workspaceId es obligatorio para derivar la llave de bóveda",
    );
  }
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(resolveMasterRootKey(), "utf-8"),
      Buffer.from(workspaceId, "utf-8"),
      Buffer.from("cendaro-rag-pii-vault-v1", "utf-8"),
      32,
    ),
  );
}

/**
 * Derives a domain-separated 256-bit (32-byte) HMAC secret key per workspace via HKDF-SHA256
 * so deterministic surrogate tokens cannot be brute-forced offline using public `workspaceId` UUIDs.
 */
export function deriveWorkspaceHmacKey(workspaceId: string): Buffer {
  if (!workspaceId || workspaceId.trim().length === 0) {
    throw new Error("workspaceId es obligatorio para derivar la llave HMAC");
  }
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(resolveMasterRootKey(), "utf-8"),
      Buffer.from(workspaceId, "utf-8"),
      Buffer.from("cendaro-rag-pii-hmac-v1", "utf-8"),
      32,
    ),
  );
}

/**
 * Encrypts a cleartext string using AES-256-GCM with a 12-byte random IV and explicit 16-byte auth tag.
 */
export function encryptPiiValue(
  plaintext: string,
  workspaceKeyOrId: Buffer | string,
): {
  ciphertext: string;
  authTag: string;
  iv: string;
  encryptedValue: string;
  buffer: Buffer;
  keyFingerprint: string;
} {
  const workspaceKey =
    typeof workspaceKeyOrId === "string"
      ? deriveWorkspaceKey(workspaceKeyOrId)
      : workspaceKeyOrId;

  if (workspaceKey.length !== 32) {
    throw new Error(
      "La llave de workspace para AES-256-GCM debe tener 32 bytes",
    );
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", workspaceKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const ivHex = iv.toString("hex");
  const authTagHex = authTag.toString("hex");
  const ciphertextHex = encrypted.toString("hex");

  const keyFingerprint = crypto
    .createHash("sha256")
    .update(workspaceKey)
    .digest("hex");

  return {
    ciphertext: ciphertextHex,
    authTag: authTagHex,
    iv: ivHex,
    encryptedValue: `${ivHex}:${authTagHex}:${ciphertextHex}`,
    buffer: Buffer.concat([iv, authTag, encrypted]),
    keyFingerprint,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload, strictly enforcing a 12-byte IV
 * and 16-byte authentication tag before verification.
 */
export function decryptPiiValue(
  encryptedValueOrParts:
    string | Buffer | { ciphertext: string; authTag: string; iv: string },
  workspaceKeyOrId: Buffer | string,
): string {
  const workspaceKey =
    typeof workspaceKeyOrId === "string"
      ? deriveWorkspaceKey(workspaceKeyOrId)
      : workspaceKeyOrId;

  if (workspaceKey.length !== 32) {
    throw new Error(
      "La llave de workspace para AES-256-GCM debe tener 32 bytes",
    );
  }

  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: Buffer;

  if (Buffer.isBuffer(encryptedValueOrParts)) {
    if (
      encryptedValueOrParts.length <
      IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES
    ) {
      throw new Error("Payload cifrado demasiado corto para AES-256-GCM");
    }
    iv = encryptedValueOrParts.subarray(0, IV_LENGTH_BYTES);
    authTag = encryptedValueOrParts.subarray(
      IV_LENGTH_BYTES,
      IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
    );
    ciphertext = encryptedValueOrParts.subarray(
      IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
    );
  } else if (typeof encryptedValueOrParts === "string") {
    if (encryptedValueOrParts.includes(":")) {
      const parts = encryptedValueOrParts.split(":");
      if (parts.length !== 3) {
        throw new Error("Formato de payload cifrado inválido");
      }
      const [ivHex = "", tagHex = "", ctHex = ""] = parts;
      if (ivHex.length !== 24 || tagHex.length !== 32) {
        throw new Error(
          "Longitud inválida de IV o etiqueta de autenticación GCM",
        );
      }
      iv = Buffer.from(ivHex, "hex");
      authTag = Buffer.from(tagHex, "hex");
      ciphertext = Buffer.from(ctHex, "hex");
    } else {
      if (encryptedValueOrParts.length < 56) {
        throw new Error("Payload hexadecimal demasiado corto para AES-256-GCM");
      }
      iv = Buffer.from(encryptedValueOrParts.slice(0, 24), "hex");
      authTag = Buffer.from(encryptedValueOrParts.slice(24, 56), "hex");
      ciphertext = Buffer.from(encryptedValueOrParts.slice(56), "hex");
    }
  } else {
    iv = Buffer.from(encryptedValueOrParts.iv, "hex");
    authTag = Buffer.from(encryptedValueOrParts.authTag, "hex");
    ciphertext = Buffer.from(encryptedValueOrParts.ciphertext, "hex");
  }

  if (
    iv.length !== IV_LENGTH_BYTES ||
    authTag.length !== AUTH_TAG_LENGTH_BYTES
  ) {
    throw new Error(
      "Longitud inválida de IV (12B) o authTag (16B) en AES-256-GCM",
    );
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", workspaceKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

/**
 * Generates deterministic HKDF-HMAC surrogate tokens for fiscal/banking IDs,
 * or ephemeral UUID surrogate tokens for commercial costs.
 */
export function generateSurrogateToken(
  entityType: string,
  cleartextValue: string,
  workspaceId: string,
): string {
  if (entityType === "rif_ve" || entityType === "rif") {
    const hmacKey = deriveWorkspaceHmacKey(workspaceId);
    const hmac = crypto
      .createHmac("sha256", hmacKey)
      .update(cleartextValue.replace(/[\s.-]/g, "").toUpperCase())
      .digest("hex")
      .slice(0, 8);
    return `<PII_RIF_${hmac}>`;
  }

  if (
    entityType === "nif_cif_es" ||
    entityType === "rfc_mx" ||
    entityType === "ein_us"
  ) {
    const hmacKey = deriveWorkspaceHmacKey(workspaceId);
    const hmac = crypto
      .createHmac("sha256", hmacKey)
      .update(cleartextValue.replace(/[\s.#-]/g, "").toUpperCase())
      .digest("hex")
      .slice(0, 8);
    return `<PII_TAX_${hmac}>`;
  }

  if (entityType === "iban" || entityType === "swift_bic") {
    const hmacKey = deriveWorkspaceHmacKey(workspaceId);
    const hmac = crypto
      .createHmac("sha256", hmacKey)
      .update(cleartextValue.replace(/[\s-]+/g, "").toUpperCase())
      .digest("hex")
      .slice(0, 8);
    return `<PII_BANK_${hmac}>`;
  }

  if (entityType === "card_pan") {
    const hmacKey = deriveWorkspaceHmacKey(workspaceId);
    const hmac = crypto
      .createHmac("sha256", hmacKey)
      .update(cleartextValue.replace(/[\s-]/g, ""))
      .digest("hex")
      .slice(0, 8);
    return `<PII_CARD_${hmac}>`;
  }

  if (entityType === "fob_cost" || entityType === "fob_price") {
    const uuid = crypto.randomUUID().slice(0, 8);
    return `<CONF_COST_${uuid}>`;
  }

  if (entityType === "commercial_margin") {
    const uuid = crypto.randomUUID().slice(0, 8);
    return `<CONF_MARGIN_${uuid}>`;
  }

  return `<PII_GEN_${crypto.randomUUID().slice(0, 8)}>`;
}

/**
 * Tokenizes sensitive PII entities in content and generates encrypted vault entries.
 * Scrubs any pre-existing forged surrogate tokens in untrusted input first to
 * prevent cross-document confused-deputy decryption oracles.
 */
export function tokenizeAndVaultContent(
  content: string,
  workspaceId: string,
  documentId: string,
): PiiTokenizationResult {
  const preCleaned = content.replace(
    FORGED_INPUT_SURROGATE_REGEX,
    "[TOKEN_EXTERNO_BLOQUEADO]",
  );

  const entities = detectPiiEntities(preCleaned);
  if (entities.length === 0) {
    return { sanitizedContent: preCleaned, vaultEntries: [] };
  }

  const workspaceKey = deriveWorkspaceKey(workspaceId);
  const keyFingerprint = crypto
    .createHash("sha256")
    .update(workspaceKey)
    .digest("hex");

  const vaultEntries: VaultRecord[] = [];
  const seenSurrogates = new Set<string>();
  let sanitized = "";
  let lastIndex = 0;

  for (const ent of entities) {
    if (ent.start < lastIndex) continue;
    sanitized += preCleaned.slice(lastIndex, ent.start);
    const surrogate = generateSurrogateToken(ent.type, ent.raw, workspaceId);
    sanitized += surrogate;

    if (!seenSurrogates.has(surrogate)) {
      seenSurrogates.add(surrogate);
      const enc = encryptPiiValue(ent.raw, workspaceKey);
      vaultEntries.push({
        id: crypto.randomUUID(),
        workspaceId,
        documentId,
        surrogateToken: surrogate,
        entityType: ent.type,
        encryptedValue: enc.encryptedValue,
        cleartextValue: ent.raw,
        iv: enc.iv,
        authTag: enc.authTag,
        buffer: enc.buffer,
        keyFingerprint,
        createdAt: new Date(),
      });
    }
    lastIndex = ent.end;
  }
  sanitized += preCleaned.slice(lastIndex);

  return { sanitizedContent: sanitized, vaultEntries };
}

/**
 * Mask mapping for unauthorized roles.
 */
function getMaskedLabelForEntityType(entityType: string): string {
  if (entityType === "rif_ve" || entityType === "rif") return "[RIF PROVEEDOR]";
  if (
    entityType === "nif_cif_es" ||
    entityType === "rfc_mx" ||
    entityType === "ein_us"
  ) {
    return "[ID FISCAL PROVEEDOR]";
  }
  if (entityType === "iban" || entityType === "swift_bic") {
    return "[DATOS BANCARIOS RESTRINGIDOS]";
  }
  if (entityType === "card_pan") return "[TARJETA DE CRÉDITO BLOQUEADA]";
  if (entityType === "fob_cost" || entityType === "fob_price") {
    return "[VALOR FOB CONFIDENCIAL]";
  }
  if (entityType === "commercial_margin") return "[CONFIDENCIAL]";
  return "[DATO PROTEGIDO]";
}

function maskSurrogateByPrefix(match: string): string {
  if (match.startsWith("<PII_RIF_")) return "[RIF PROVEEDOR]";
  if (match.startsWith("<PII_TAX_")) return "[ID FISCAL PROVEEDOR]";
  if (match.startsWith("<PII_BANK_")) return "[DATOS BANCARIOS RESTRINGIDOS]";
  if (match.startsWith("<PII_CARD_")) return "[TARJETA DE CRÉDITO BLOQUEADA]";
  if (match.startsWith("<CONF_COST_")) return "[VALOR FOB CONFIDENCIAL]";
  if (match.startsWith("<CONF_MARGIN_")) return "[CONFIDENCIAL]";
  return "[CONFIDENCIAL]";
}

/**
 * Batch-rehydrates surrogate tokens across multiple document chunks in a SINGLE
 * SQL query strictly scoped by `(workspace_id, document_id IN (...), surrogate_token IN (...))`.
 * Prevents both cross-document RBAC decryption oracles and N+1 query fan-out.
 */
export async function rehydrateChunksBatch(
  chunks: readonly { documentId: string; content: string }[],
  workspaceId: string,
  userRole: string,
  db?: NodePgDatabase<Record<string, unknown>>,
): Promise<string[]> {
  if (chunks.length === 0) return [];

  const isAuthorized = MANAGEMENT_ROLES.has(userRole);
  if (!isAuthorized) {
    return chunks.map((c) =>
      (c.content || "").replace(SURROGATE_TOKEN_REGEX, maskSurrogateByPrefix),
    );
  }

  if (!db) {
    return chunks.map((c) => c.content || "");
  }

  const tokenSet = new Set<string>();
  const docIdSet = new Set<string>();
  for (const chunk of chunks) {
    const text = chunk.content || "";
    const matches = text.match(SURROGATE_TOKEN_REGEX);
    if (matches && matches.length > 0) {
      docIdSet.add(chunk.documentId);
      for (const tok of matches) tokenSet.add(tok);
    }
  }

  if (tokenSet.size === 0 || docIdSet.size === 0) {
    return chunks.map((c) => c.content || "");
  }

  const rows = await db
    .select({
      documentId: ragPiiVault.documentId,
      surrogateToken: ragPiiVault.surrogateToken,
      encryptedValue: ragPiiVault.encryptedValue,
    })
    .from(ragPiiVault)
    .where(
      and(
        eq(ragPiiVault.workspaceId, workspaceId),
        inArray(ragPiiVault.documentId, Array.from(docIdSet)),
        inArray(ragPiiVault.surrogateToken, Array.from(tokenSet)),
      ),
    );

  const workspaceKey = deriveWorkspaceKey(workspaceId);
  const decryptedByDocToken = new Map<string, string>();
  for (const row of rows) {
    if (
      typeof row.documentId !== "string" ||
      typeof row.surrogateToken !== "string"
    ) {
      continue;
    }
    const compositeKey = `${row.documentId}::${row.surrogateToken}`;
    if (!decryptedByDocToken.has(compositeKey)) {
      try {
        decryptedByDocToken.set(
          compositeKey,
          decryptPiiValue(row.encryptedValue, workspaceKey),
        );
      } catch {
        decryptedByDocToken.set(compositeKey, "[ERROR DE DESCIFRADO]");
      }
    }
  }

  return chunks.map((chunk) =>
    (chunk.content || "").replace(SURROGATE_TOKEN_REGEX, (match) => {
      return (
        decryptedByDocToken.get(`${chunk.documentId}::${match}`) ??
        "[CONFIDENCIAL]"
      );
    }),
  );
}

const STRUCTURAL_METADATA_KEYS: ReadonlySet<string> = new Set([
  "allowedRoles",
  "allowed_roles",
  "accessRoles",
  "restrictedFields",
  "vendorId",
  "customerId",
]);

function collectMetadataSurrogates(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const matches = value.match(SURROGATE_TOKEN_REGEX);
    if (matches) {
      for (const tok of matches) out.add(tok);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMetadataSurrogates(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!STRUCTURAL_METADATA_KEYS.has(k)) {
        collectMetadataSurrogates(v, out);
      }
    }
  }
}

function transformMetadataStrings(
  value: unknown,
  transformStr: (raw: string) => string,
): unknown {
  if (typeof value === "string") {
    return transformStr(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => transformMetadataStrings(item, transformStr));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (STRUCTURAL_METADATA_KEYS.has(k)) {
        out[k] = v;
      } else {
        out[k] = transformMetadataStrings(v, transformStr);
      }
    }
    return out;
  }
  return value;
}

/**
 * Batch-rehydrates surrogate tokens inside JSON metadata objects in a SINGLE
 * SQL query strictly scoped by `(workspace_id, document_id IN (...), surrogate_token IN (...))`,
 * and runs Output DLP over string metadata fields (closes FINDING-05 / V-10).
 *
 * - Management roles (`owner`, `admin`, `supervisor`) receive decrypted cleartext values.
 * - Non-management roles receive semantic masked labels (`[RIF PROVEEDOR]`, etc.).
 */
export async function rehydrateMetadataBatch(
  items: readonly { documentId: string; metadata: Record<string, unknown> }[],
  workspaceId: string,
  userRole: string,
  db?: NodePgDatabase<Record<string, unknown>>,
): Promise<Record<string, unknown>[]> {
  if (items.length === 0) return [];

  const isAuthorized = MANAGEMENT_ROLES.has(userRole);
  if (!isAuthorized) {
    return items.map(
      (item) =>
        transformMetadataStrings(
          item.metadata,
          (str) =>
            scanOutputDLP(
              str.replace(SURROGATE_TOKEN_REGEX, maskSurrogateByPrefix),
            ).sanitized,
        ) as Record<string, unknown>,
    );
  }

  const tokenSet = new Set<string>();
  const docIdSet = new Set<string>();
  for (const item of items) {
    const localTokens = new Set<string>();
    collectMetadataSurrogates(item.metadata, localTokens);
    if (localTokens.size > 0) {
      docIdSet.add(item.documentId);
      for (const tok of localTokens) tokenSet.add(tok);
    }
  }

  if (!db || tokenSet.size === 0 || docIdSet.size === 0) {
    return items.map(
      (item) =>
        transformMetadataStrings(
          item.metadata,
          (str) => scanOutputDLP(str).sanitized,
        ) as Record<string, unknown>,
    );
  }

  const rows = await db
    .select({
      documentId: ragPiiVault.documentId,
      surrogateToken: ragPiiVault.surrogateToken,
      encryptedValue: ragPiiVault.encryptedValue,
    })
    .from(ragPiiVault)
    .where(
      and(
        eq(ragPiiVault.workspaceId, workspaceId),
        inArray(ragPiiVault.documentId, Array.from(docIdSet)),
        inArray(ragPiiVault.surrogateToken, Array.from(tokenSet)),
      ),
    );

  const workspaceKey = deriveWorkspaceKey(workspaceId);
  const decryptedByDocToken = new Map<string, string>();
  for (const row of rows) {
    if (
      typeof row.documentId !== "string" ||
      typeof row.surrogateToken !== "string"
    ) {
      continue;
    }
    const compositeKey = `${row.documentId}::${row.surrogateToken}`;
    if (!decryptedByDocToken.has(compositeKey)) {
      try {
        decryptedByDocToken.set(
          compositeKey,
          decryptPiiValue(row.encryptedValue, workspaceKey),
        );
      } catch {
        decryptedByDocToken.set(compositeKey, "[ERROR DE DESCIFRADO]");
      }
    }
  }

  return items.map(
    (item) =>
      transformMetadataStrings(item.metadata, (str) => {
        const rehydrated = str.replace(SURROGATE_TOKEN_REGEX, (match) => {
          return (
            decryptedByDocToken.get(`${item.documentId}::${match}`) ??
            "[CONFIDENCIAL]"
          );
        });
        return scanOutputDLP(rehydrated).sanitized;
      }) as Record<string, unknown>,
  );
}

/**
 * Re-hydrates surrogate tokens for a single chunk based on caller role clearance.
 */
export function rehydrateSurrogateTokens(
  content: string,
  workspaceId: string,
  userRole: string,
  vaultRecords: VaultRecord[],
): string;
export function rehydrateSurrogateTokens(
  content: string,
  workspaceId: string,
  userRole: string,
  db?: NodePgDatabase<Record<string, unknown>>,
  documentId?: string,
): Promise<string>;
export function rehydrateSurrogateTokens(
  content: string,
  workspaceId: string,
  userRole: string,
  vaultOrDb?: NodePgDatabase<Record<string, unknown>> | VaultRecord[],
  documentId?: string,
): string | Promise<string> {
  const isAuthorized = MANAGEMENT_ROLES.has(userRole);

  // Case 1: In-memory array of VaultRecords passed (synchronous)
  if (Array.isArray(vaultOrDb)) {
    const vaultMap = new Map<string, VaultRecord>();
    for (const v of vaultOrDb) {
      if (
        v.workspaceId === workspaceId &&
        (!documentId || v.documentId === documentId)
      ) {
        vaultMap.set(v.surrogateToken, v);
      }
    }

    const workspaceKey = isAuthorized ? deriveWorkspaceKey(workspaceId) : null;

    return content.replace(SURROGATE_TOKEN_REGEX, (match) => {
      const entry = vaultMap.get(match);
      if (!entry) {
        return "[CONFIDENCIAL]";
      }

      if (isAuthorized && workspaceKey) {
        if (entry.cleartextValue) {
          return entry.cleartextValue;
        }
        return decryptPiiValue(entry.encryptedValue, workspaceKey);
      }

      return getMaskedLabelForEntityType(entry.entityType);
    });
  }

  // Case 2: Database instance passed or no vaultRecords (asynchronous)
  return (async () => {
    if (!isAuthorized) {
      return content.replace(SURROGATE_TOKEN_REGEX, maskSurrogateByPrefix);
    }

    const db = vaultOrDb;
    if (!db) {
      return content;
    }

    const matches = Array.from(content.matchAll(SURROGATE_TOKEN_REGEX)).map(
      (m) => m[0],
    );
    if (matches.length === 0) {
      return content;
    }

    const uniqueTokens = Array.from(new Set(matches));
    const rows = await db
      .select({
        surrogateToken: ragPiiVault.surrogateToken,
        encryptedValue: ragPiiVault.encryptedValue,
      })
      .from(ragPiiVault)
      .where(
        and(
          eq(ragPiiVault.workspaceId, workspaceId),
          documentId ? eq(ragPiiVault.documentId, documentId) : undefined,
          inArray(ragPiiVault.surrogateToken, uniqueTokens),
        ),
      );

    const decryptedMap = new Map<string, string>();
    const workspaceKey = deriveWorkspaceKey(workspaceId);

    for (const row of rows) {
      if (!decryptedMap.has(row.surrogateToken)) {
        try {
          decryptedMap.set(
            row.surrogateToken,
            decryptPiiValue(row.encryptedValue, workspaceKey),
          );
        } catch {
          decryptedMap.set(row.surrogateToken, "[ERROR DE DESCIFRADO]");
        }
      }
    }

    return content.replace(SURROGATE_TOKEN_REGEX, (match) => {
      return decryptedMap.get(match) ?? "[CONFIDENCIAL]";
    });
  })();
}
