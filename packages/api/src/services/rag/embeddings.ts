/**
 * Cendaro — RAG Vector Embedding Generator
 *
 * Generates 1536-dimensional cosine-normalized vector embeddings (||v||₂ = 1.0):
 *   • Google Gemini `gemini-embedding-001` (`outputDimensionality: 1536` + strict L2
 *     re-normalization and `x-goog-api-key` header auth) when `GEMINI_API_KEY` is configured.
 *   • OpenAI `text-embedding-3-small` (`dimensions: 1536`) when `OPENAI_API_KEY` is configured.
 *   • Deterministic offline token-weighted frequency hashing (SimHash / Feature Hashing)
 *     when no external embedding API key is configured (for local/CI unit tests).
 *   • Strict fail-closed behavior (`RagEmbeddingProviderError`) whenever an external
 *     embedding provider is configured and fails, preventing orthogonal vector-space mixing (V-03).
 */

import { logger } from "../../logger";

export const EMBEDDING_DIMENSIONS = 1536;
const GEMINI_MAX_BATCH_SIZE = 100;
const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-001";
const GEMINI_BATCH_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";

export class RagEmbeddingProviderError extends Error {
  readonly code = "RAG_EMBEDDING_PROVIDER_ERROR";

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RagEmbeddingProviderError";
    if (cause) this.cause = cause;
  }
}

// ──────────────────────────────────────────────
// Deterministic Hash Primitives (FNV-1a 32-bit)
// ──────────────────────────────────────────────

const FNV_PRIME = 16777619;
const FNV_OFFSET_BASIS_1 = 2166136261;
const FNV_OFFSET_BASIS_2 = 3735928559; // 0xDEADBEEF seed for secondary projection

function fnv1a(str: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0; // unsigned 32-bit integer
}

// ──────────────────────────────────────────────
// Offline Deterministic Feature Hashing Embedder
// ──────────────────────────────────────────────

/**
 * Generates a 1536-dimensional unit-normalized vector using token-weighted frequency hashing.
 * Captures both whole word semantics and subword character trigrams for multilingual typo resilience.
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const vector = new Float64Array(EMBEDDING_DIMENSIONS);
  if (!text || text.trim().length === 0) {
    // Return deterministic unit vector for empty input
    vector[0] = 1.0;
    return Array.from(vector);
  }

  const normalized = text.toLowerCase().normalize("NFKC");

  // Tokenize into words, numbers, and alphanumeric identifiers (e.g. SKUs, RIFs, container codes)
  const tokens = normalized.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  const tokenFrequencies = new Map<string, number>();

  for (const token of tokens) {
    tokenFrequencies.set(token, (tokenFrequencies.get(token) ?? 0) + 1);
  }

  // 1. Process whole word tokens with sublinear TF weighting
  for (const [token, count] of tokenFrequencies.entries()) {
    const weight = 1.0 + Math.log(count);

    // Primary hash bucket and sign
    const h1 = fnv1a(token, FNV_OFFSET_BASIS_1);
    const idx1 = h1 % EMBEDDING_DIMENSIONS;
    const sign1 = (h1 & 1) === 0 ? 1.0 : -1.0;
    vector[idx1] = (vector[idx1] ?? 0) + sign1 * weight;

    // Secondary hash bucket and sign (reduces collisions and spreads feature representation)
    const h2 = fnv1a(token, FNV_OFFSET_BASIS_2);
    const idx2 = h2 % EMBEDDING_DIMENSIONS;
    const sign2 = (h2 & 2) === 0 ? 1.0 : -1.0;
    vector[idx2] = (vector[idx2] ?? 0) + sign2 * weight * 0.7;
  }

  // 2. Process subword character 3-grams for morphological and typo matching
  for (let i = 0; i <= normalized.length - 3; i++) {
    const trigram = normalized.substring(i, i + 3);
    const hTri = fnv1a(trigram, FNV_OFFSET_BASIS_1);
    const idx = hTri % EMBEDDING_DIMENSIONS;
    const sign = (hTri & 4) === 0 ? 1.0 : -1.0;
    // Subword features are weighted at 0.35 of whole-word weight
    vector[idx] = (vector[idx] ?? 0) + sign * 0.35;
  }

  // 3. Cosine Normalization (L2 Euclidean Norm = 1.0)
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const val = vector[i] ?? 0;
    sumSq += val * val;
  }

  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      vector[i] = (vector[i] ?? 0) / norm;
    }
  } else {
    // Fallback unit vector if sum was zero
    vector[0] = 1.0;
  }

  return Array.from(vector);
}

/**
 * Enforces strict Euclidean L2 unit normalization (||v||₂ = 1.0) on any 1536-dim vector.
 * Essential for Matryoshka-truncated models such as `gemini-embedding-001` (`outputDimensionality: 1536`),
 * whose raw truncated slice has ||v||₂ < 1.0 prior to re-normalization.
 */
export function normalizeL2Vector(values: readonly number[]): number[] {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new RagEmbeddingProviderError(
      `Dimensión de embedding inválida: se esperaban ${EMBEDDING_DIMENSIONS}, recibido ${values.length}`,
    );
  }
  const out = new Float64Array(EMBEDDING_DIMENSIONS);
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const val = values[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new RagEmbeddingProviderError(
        "El proveedor de embeddings devolvió componentes no numéricos o infinitos",
      );
    }
    out[i] = val;
    sumSq += val * val;
  }
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      out[i] = (out[i] ?? 0) / norm;
    }
  } else {
    out[0] = 1.0;
  }
  return Array.from(out);
}

// ──────────────────────────────────────────────
// Google Gemini Embedding Integration (`gemini-embedding-001`)
// ──────────────────────────────────────────────

export interface EmbeddingCallOptions {
  timeoutMs?: number;
}

async function fetchGeminiSubBatch(
  subBatch: string[],
  apiKey: string,
  timeoutMs = 8000,
): Promise<number[][] | null> {
  const payload = {
    requests: subBatch.map((t) => ({
      model: GEMINI_EMBEDDING_MODEL,
      outputDimensionality: EMBEDDING_DIMENSIONS,
      content: {
        parts: [
          {
            text: t.trim().length > 0 ? t.slice(0, 8000) : " ",
          },
        ],
      },
    })),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(GEMINI_BATCH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Passed strictly via header (never URL `?key=`) so secrets never appear in logs
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        continue;
      }

      if (
        (response.status === 502 ||
          response.status === 503 ||
          response.status === 504) &&
        attempt === 0
      ) {
        const jitterMs = 300 + Math.floor(Math.random() * 200);
        await new Promise((resolve) => setTimeout(resolve, jitterMs));
        continue;
      }

      if (!response.ok) {
        logger.warn(`Gemini embedding API returned status ${response.status}`, {
          module: "rag-embeddings",
          provider: "gemini",
        });
        return null;
      }

      const data = (await response.json()) as {
        embeddings?: { values?: number[] }[];
      };

      if (
        !Array.isArray(data.embeddings) ||
        data.embeddings.length !== subBatch.length
      ) {
        return null;
      }

      const normalizedVectors: number[][] = [];
      for (const item of data.embeddings) {
        if (
          !Array.isArray(item.values) ||
          item.values.length !== EMBEDDING_DIMENSIONS
        ) {
          return null;
        }
        normalizedVectors.push(normalizeL2Vector(item.values));
      }

      return normalizedVectors;
    } catch (err) {
      logger.warn(
        "Gemini embedding request failed or timed out",
        { module: "rag-embeddings", provider: "gemini" },
        err,
      );
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

async function fetchGeminiEmbeddingsBatch(
  texts: string[],
  apiKey: string,
  timeoutMs = 8000,
): Promise<number[][] | null> {
  if (texts.length === 0) return [];

  const allVectors: number[][] = [];
  for (let start = 0; start < texts.length; start += GEMINI_MAX_BATCH_SIZE) {
    const slice = texts.slice(start, start + GEMINI_MAX_BATCH_SIZE);
    const subVectors = await fetchGeminiSubBatch(slice, apiKey, timeoutMs);
    if (!subVectors) {
      return null;
    }
    allVectors.push(...subVectors);
  }
  return allVectors;
}

// ──────────────────────────────────────────────
// OpenAI Embedding Integration (Optional)
// ──────────────────────────────────────────────

async function fetchOpenAIEmbeddingsBatch(
  texts: string[],
  apiKey: string,
  timeoutMs = 3500,
): Promise<number[][] | null> {
  if (texts.length === 0) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texts.map((t) => t.slice(0, 8000)), // OpenAI token safety clamp
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn(`OpenAI embedding API returned status ${response.status}`, {
        module: "rag-embeddings",
      });
      return null;
    }

    const data = (await response.json()) as {
      data?: { index?: number; embedding: number[] }[];
    };

    if (!Array.isArray(data.data) || data.data.length !== texts.length) {
      return null;
    }

    const ordered = [...data.data].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    const vectors: number[][] = [];
    for (const item of ordered) {
      if (
        !Array.isArray(item.embedding) ||
        item.embedding.length !== EMBEDDING_DIMENSIONS
      ) {
        return null;
      }
      vectors.push(item.embedding);
    }

    return vectors;
  } catch (err) {
    logger.warn(
      "OpenAI embedding request failed or timed out",
      { module: "rag-embeddings" },
      err,
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchOpenAIEmbedding(
  text: string,
  apiKey: string,
  timeoutMs = 3500,
): Promise<number[] | null> {
  const batch = await fetchOpenAIEmbeddingsBatch([text], apiKey, timeoutMs);
  return batch?.[0] ?? null;
}

function resolveActiveProvider(): {
  provider: "openai" | "gemini" | "local";
  apiKey: string;
} {
  const forced = process.env.RAG_EMBEDDING_PROVIDER?.trim().toLowerCase();
  const openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";

  const hasValidOpenAi = openAiKey.length > 0 && !openAiKey.startsWith("mock-");
  const hasValidGemini = geminiKey.length > 0 && !geminiKey.startsWith("mock-");

  if (forced === "local") {
    return { provider: "local", apiKey: "" };
  }
  if (forced === "gemini") {
    if (!hasValidGemini) {
      throw new RagEmbeddingProviderError(
        "RAG_EMBEDDING_PROVIDER=gemini está activo pero GEMINI_API_KEY no está configurada.",
      );
    }
    return { provider: "gemini", apiKey: geminiKey };
  }
  if (forced === "openai") {
    if (!hasValidOpenAi) {
      throw new RagEmbeddingProviderError(
        "RAG_EMBEDDING_PROVIDER=openai está activo pero OPENAI_API_KEY no está configurada.",
      );
    }
    return { provider: "openai", apiKey: openAiKey };
  }

  if (hasValidOpenAi) {
    return { provider: "openai", apiKey: openAiKey };
  }
  if (hasValidGemini) {
    return { provider: "gemini", apiKey: geminiKey };
  }
  return { provider: "local", apiKey: "" };
}

export function resolveActiveEmbeddingProviderName():
  "openai" | "gemini" | "local" {
  return resolveActiveProvider().provider;
}

// ──────────────────────────────────────────────
// Primary Public Embedding Functions
// ──────────────────────────────────────────────

/**
 * Generates a 1536-dimensional cosine-normalized vector embedding for a given text.
 * Uses OpenAI (`OPENAI_API_KEY`) or Google Gemini `gemini-embedding-001` (`GEMINI_API_KEY`)
 * when configured, failing closed on provider errors (V-03); otherwise runs the deterministic
 * offline embedding algorithm.
 */
export async function generateEmbedding(
  text: string,
  options?: EmbeddingCallOptions,
): Promise<number[]> {
  const active = resolveActiveProvider();

  if (active.provider === "openai") {
    const openAiVector = await fetchOpenAIEmbedding(
      text,
      active.apiKey,
      options?.timeoutMs ?? 3500,
    );
    if (!openAiVector) {
      throw new RagEmbeddingProviderError(
        "OpenAI embedding generation failed or timed out. Silent fallback to offline hashing is prohibited (V-03).",
      );
    }
    return normalizeL2Vector(openAiVector);
  }

  if (active.provider === "gemini") {
    const geminiBatch = await fetchGeminiEmbeddingsBatch(
      [text],
      active.apiKey,
      options?.timeoutMs ?? 8000,
    );
    const geminiVector = geminiBatch?.[0];
    if (!geminiVector) {
      throw new RagEmbeddingProviderError(
        "Gemini embedding generation failed or timed out. Silent fallback to offline hashing is prohibited (V-03).",
      );
    }
    return geminiVector;
  }

  return generateDeterministicEmbedding(text);
}

/**
 * Generates vector embeddings for a batch of text chunks via OpenAI, Google Gemini
 * (`gemini-embedding-001` with automatic <= 100 sub-batching and L2 normalization),
 * or deterministic offline feature hashing.
 */
export async function generateEmbeddings(
  texts: string[],
  options?: EmbeddingCallOptions,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const active = resolveActiveProvider();

  if (active.provider === "openai") {
    const openAiVectors = await fetchOpenAIEmbeddingsBatch(
      texts,
      active.apiKey,
      options?.timeoutMs ?? 3500,
    );
    if (!openAiVectors) {
      throw new RagEmbeddingProviderError(
        "OpenAI batch embedding generation failed or timed out. Silent fallback to offline hashing is prohibited (V-03).",
      );
    }
    return openAiVectors.map((vec) => normalizeL2Vector(vec));
  }

  if (active.provider === "gemini") {
    const geminiVectors = await fetchGeminiEmbeddingsBatch(
      texts,
      active.apiKey,
      options?.timeoutMs ?? 8000,
    );
    if (!geminiVectors) {
      throw new RagEmbeddingProviderError(
        "Gemini batch embedding generation failed or timed out. Silent fallback to offline hashing is prohibited (V-03).",
      );
    }
    return geminiVectors;
  }

  return texts.map((text) => generateDeterministicEmbedding(text));
}

// ──────────────────────────────────────────────
// Vector Math Helpers
// ──────────────────────────────────────────────

/**
 * Computes cosine similarity between two 1536-dimensional vectors.
 * Since vectors are unit-normalized (||v|| = 1.0), this equals the dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Math.max(-1.0, Math.min(1.0, dotProduct));
}
