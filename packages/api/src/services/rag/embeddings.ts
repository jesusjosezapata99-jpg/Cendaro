/**
 * Cendaro — RAG Vector Embedding Generator
 *
 * Generates 1536-dimensional cosine-normalized vector embeddings.
 * Features:
 *   • Deterministic offline token-weighted frequency hashing (SimHash / Feature Hashing)
 *     for reliable, zero-dependency, network-free operation in tests and development.
 *   • Automatic OpenAI `text-embedding-3-small` integration when `OPENAI_API_KEY` is present,
 *     with graceful fallback to offline deterministic embeddings on network errors.
 *   • Cosine normalization: all vectors satisfy ||v||₂ = 1.0.
 */

import { logger } from "../../logger";

export const EMBEDDING_DIMENSIONS = 1536;

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

// ──────────────────────────────────────────────
// OpenAI Embedding Integration (Optional)
// ──────────────────────────────────────────────

async function fetchOpenAIEmbeddingsBatch(
  texts: string[],
  apiKey: string,
): Promise<number[][] | null> {
  if (texts.length === 0) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

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
      "OpenAI embedding request failed, falling back to deterministic embedder",
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
): Promise<number[] | null> {
  const batch = await fetchOpenAIEmbeddingsBatch([text], apiKey);
  return batch?.[0] ?? null;
}

// ──────────────────────────────────────────────
// Primary Public Embedding Functions
// ──────────────────────────────────────────────

/**
 * Generates a 1536-dimensional cosine-normalized vector embedding for a given text.
 * Automatically utilizes OpenAI text-embedding-3-small when OPENAI_API_KEY is configured,
 * otherwise runs the fast, deterministic offline embedding algorithm.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim().length > 0 && !apiKey.startsWith("mock-")) {
    const openAiVector = await fetchOpenAIEmbedding(text, apiKey);
    if (openAiVector) {
      return openAiVector;
    }
  }

  return generateDeterministicEmbedding(text);
}

/**
 * Generates vector embeddings for a batch of text chunks in a single API call
 * (when OpenAI is configured) or via deterministic offline feature hashing.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim().length > 0 && !apiKey.startsWith("mock-")) {
    const openAiVectors = await fetchOpenAIEmbeddingsBatch(texts, apiKey);
    if (openAiVectors) {
      return openAiVectors;
    }
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
