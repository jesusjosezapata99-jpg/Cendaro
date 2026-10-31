/**
 * Cendaro — Cryptographic Token Vault (PRD v2.0, F11.3)
 *
 * Provides authenticated symmetric encryption (`AES-256-GCM`) for external
 * OAuth tokens and integration secrets (e.g. Mercado Libre access/refresh tokens)
 * at rest. Uses a 96-bit random IV and 128-bit authentication tag per secret.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const VERSION_PREFIX = "v1";

function deriveVaultKey(rawSecret?: string): Buffer {
  const source =
    rawSecret ??
    (process.env.INTEGRATION_VAULT_KEY?.trim()
      ? process.env.INTEGRATION_VAULT_KEY.trim()
      : undefined) ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "cendaro-dev-fallback-vault-key-do-not-use-in-prod");

  if (!source) {
    throw new Error(
      "INTEGRATION_VAULT_KEY es obligatoria en producción para el cifrado del vault",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(source)) {
    return Buffer.from(source, "hex");
  }
  return createHash("sha256")
    .update(`cendaro:integration-vault:v1:${source}`, "utf8")
    .digest();
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Output format: `v1:<ivHex>:<authTagHex>:<ciphertextHex>`
 */
export function encryptSecret(plaintext: string, customKey?: string): string {
  const key = deriveVaultKey(customKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION_PREFIX,
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a `v1:<ivHex>:<authTagHex>:<ciphertextHex>` payload with AES-256-GCM.
 * Throws if the ciphertext or authentication tag has been tampered with.
 */
export function decryptSecret(payload: string, customKey?: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Formato de secreto cifrado inválido en crypto-vault");
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  if (!ivHex || !tagHex || cipherHex === undefined) {
    throw new Error("Componentes de cifrado incompletos en crypto-vault");
  }

  const key = deriveVaultKey(customKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
