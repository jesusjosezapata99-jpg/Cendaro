/**
 * Cryptographic primitives for Cendaro `audit_log` external notarization.
 *
 * Implements RFC 6962 §2.1 domain-separated SHA-256 binary Merkle trees:
 *   • Leaf hash:     SHA-256(0x00 || UTF8(canonicalLeafPayload))
 *   • Internal hash: SHA-256(0x01 || leftBytes32 || rightBytes32)
 *   • Odd nodes are promoted directly to the next level without duplication,
 *     preventing CVE-2012-2459 duplicate-leaf second-preimage forgery.
 */
import crypto from "node:crypto";

const LEAF_DOMAIN_PREFIX = Buffer.from([0x00]);
const NODE_DOMAIN_PREFIX = Buffer.from([0x01]);

/**
 * Formats an `audit_log` header row into its canonical leaf string.
 *
 * @param {{ workspaceId: string | null; seq: number | string | bigint; prevHash: string; chainHash: string }} row
 * @returns {string}
 */
export function canonicalAuditLeafString(row) {
  const ws = row.workspaceId ?? "global";
  return `${ws}:${String(row.seq)}:${row.prevHash}:${row.chainHash}`;
}

/**
 * Computes RFC 6962 leaf hash `SHA256(0x00 || UTF8(payload))`.
 *
 * @param {string} payload
 * @returns {string} 64-char lowercase hex digest
 */
export function hashMerkleLeaf(payload) {
  return crypto
    .createHash("sha256")
    .update(LEAF_DOMAIN_PREFIX)
    .update(Buffer.from(payload, "utf8"))
    .digest("hex");
}

/**
 * Computes RFC 6962 internal node hash `SHA256(0x01 || left || right)`.
 *
 * @param {string} leftHex
 * @param {string} rightHex
 * @returns {string} 64-char lowercase hex digest
 */
export function hashMerkleNode(leftHex, rightHex) {
  return crypto
    .createHash("sha256")
    .update(NODE_DOMAIN_PREFIX)
    .update(Buffer.from(leftHex, "hex"))
    .update(Buffer.from(rightHex, "hex"))
    .digest("hex");
}

/**
 * Computes the deterministic RFC 6962 binary Merkle root over an ordered array
 * of leaf payload strings. Empty windows hash a domain-separated `EMPTY_WINDOW`
 * sentinel bound to the window boundaries.
 *
 * @param {string[]} leafPayloads
 * @param {{ windowStart?: string; windowEnd?: string }} [emptyMeta]
 * @returns {string}
 */
export function computeMerkleRoot(leafPayloads, emptyMeta) {
  if (leafPayloads.length === 0) {
    const start = emptyMeta?.windowStart ?? "GENESIS";
    const end = emptyMeta?.windowEnd ?? "HEAD";
    return hashMerkleLeaf(`EMPTY_WINDOW:${start}:${end}`);
  }

  let level = leafPayloads.map((p) => hashMerkleLeaf(p));
  while (level.length > 1) {
    /** @type {string[]} */
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1];
      if (!left) continue;
      if (right === undefined) {
        // RFC 6962 odd-node promotion (never duplicate trailing node)
        next.push(left);
      } else {
        next.push(hashMerkleNode(left, right));
      }
    }
    level = next;
  }

  return level[0] ?? hashMerkleLeaf("EMPTY_WINDOW:GENESIS:HEAD");
}

/**
 * Generates an RFC 6962 Merkle inclusion proof for `leafIndex`.
 *
 * @param {string[]} leafPayloads
 * @param {number} leafIndex
 * @returns {{ side: "left" | "right"; hash: string }[]}
 */
export function generateMerkleInclusionProof(leafPayloads, leafIndex) {
  if (leafIndex < 0 || leafIndex >= leafPayloads.length) {
    throw new RangeError("leafIndex out of bounds");
  }

  /** @type {{ side: "left" | "right"; hash: string }[]} */
  const proof = [];
  let idx = leafIndex;
  let level = leafPayloads.map((p) => hashMerkleLeaf(p));

  while (level.length > 1) {
    /** @type {string[]} */
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1];
      if (!left) continue;

      if (right === undefined) {
        next.push(left);
      } else {
        if (i === idx) {
          proof.push({ side: "right", hash: right });
        } else if (i + 1 === idx) {
          proof.push({ side: "left", hash: left });
        }
        next.push(hashMerkleNode(left, right));
      }
    }
    idx = Math.floor(idx / 2);
    level = next;
  }

  return proof;
}

/**
 * Verifies an RFC 6962 Merkle inclusion proof against `expectedRoot`.
 *
 * @param {string} leafPayload
 * @param {{ side: "left" | "right"; hash: string }[]} proof
 * @param {string} expectedRoot
 * @returns {boolean}
 */
export function verifyMerkleInclusionProof(leafPayload, proof, expectedRoot) {
  let current = hashMerkleLeaf(leafPayload);
  for (const step of proof) {
    current =
      step.side === "left"
        ? hashMerkleNode(step.hash, current)
        : hashMerkleNode(current, step.hash);
  }
  return current === expectedRoot;
}

/**
 * Verifies per-workspace `prev_hash -> chain_hash` linear continuity across an
 * ordered window of rows (`ORDER BY seq ASC`).
 *
 * @param {{ workspaceId: string | null; seq: number | string | bigint; prevHash: string; chainHash: string }[]} rows
 * @param {Map<string, string>} [priorWorkspaceTips] Optional expected `prevHash` before first row in window
 * @returns {{ valid: boolean; brokenLinks: { workspaceId: string; seq: string; expectedPrev: string; actualPrev: string }[]; workspaceTips: { workspaceId: string; maxSeq: string; tipChainHash: string }[] }}
 */
export function verifyLinearChainWindow(rows, priorWorkspaceTips) {
  /** @type {Map<string, { maxSeq: string; tipChainHash: string }>} */
  const tips = new Map();
  /** @type {{ workspaceId: string; seq: string; expectedPrev: string; actualPrev: string }[]} */
  const brokenLinks = [];

  for (const row of rows) {
    const ws = row.workspaceId ?? "global";
    const seqStr = String(row.seq);
    const currentTip = tips.get(ws);

    if (currentTip) {
      if (row.prevHash !== currentTip.tipChainHash) {
        brokenLinks.push({
          workspaceId: ws,
          seq: seqStr,
          expectedPrev: currentTip.tipChainHash,
          actualPrev: row.prevHash,
        });
      }
    } else if (priorWorkspaceTips?.has(ws)) {
      const expected = priorWorkspaceTips.get(ws) ?? "GENESIS";
      if (row.prevHash !== expected) {
        brokenLinks.push({
          workspaceId: ws,
          seq: seqStr,
          expectedPrev: expected,
          actualPrev: row.prevHash,
        });
      }
    }

    tips.set(ws, { maxSeq: seqStr, tipChainHash: row.chainHash });
  }

  const workspaceTips = [...tips.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([workspaceId, info]) => ({
      workspaceId,
      maxSeq: info.maxSeq,
      tipChainHash: info.tipChainHash,
    }));

  return {
    valid: brokenLinks.length === 0,
    brokenLinks,
    workspaceTips,
  };
}

/**
 * Builds a deterministic canonical checkpoint object + SHA-256 digest.
 *
 * @param {{
 *   windowStart: string;
 *   windowEnd: string;
 *   rows: { workspaceId: string | null; seq: number | string | bigint; prevHash: string; chainHash: string }[];
 * }} opts
 */
export function buildNotarizationCheckpoint(opts) {
  const chainCheck = verifyLinearChainWindow(opts.rows);
  if (!chainCheck.valid) {
    throw new Error(
      `Audit chain linear verification failed (${chainCheck.brokenLinks.length} broken link(s))`,
    );
  }

  const leaves = opts.rows.map((r) => canonicalAuditLeafString(r));
  const merkleRoot = computeMerkleRoot(leaves, {
    windowStart: opts.windowStart,
    windowEnd: opts.windowEnd,
  });

  const firstSeq = opts.rows[0] ? String(opts.rows[0].seq) : null;
  const lastRow = opts.rows.at(-1);
  const lastSeq = lastRow ? String(lastRow.seq) : null;

  const statement = {
    schemaVersion: 1,
    algorithm: "rfc6962-sha256",
    windowStart: opts.windowStart,
    windowEnd: opts.windowEnd,
    rowCount: opts.rows.length,
    minSeq: firstSeq,
    maxSeq: lastSeq,
    merkleRoot,
    workspaceTips: chainCheck.workspaceTips,
  };

  const canonicalJson = JSON.stringify(statement);
  const checkpointDigest = crypto
    .createHash("sha256")
    .update(canonicalJson, "utf8")
    .digest("hex");

  return {
    statement,
    canonicalJson,
    checkpointDigest,
  };
}

/**
 * Signs a canonical checkpoint JSON string using a PEM-encoded Ed25519 private key.
 *
 * @param {string} canonicalJson
 * @param {string} privateKeyPem
 * @returns {string} base64 signature
 */
export function signCheckpointEd25519(canonicalJson, privateKeyPem) {
  const key = crypto.createPrivateKey(privateKeyPem);
  return crypto
    .sign(null, Buffer.from(canonicalJson, "utf8"), key)
    .toString("base64");
}

/**
 * Verifies a detached base64 Ed25519 signature over `canonicalJson`.
 *
 * @param {string} canonicalJson
 * @param {string} signatureBase64
 * @param {string} publicKeyPem
 * @returns {boolean}
 */
export function verifyCheckpointEd25519(
  canonicalJson,
  signatureBase64,
  publicKeyPem,
) {
  const key = crypto.createPublicKey(publicKeyPem);
  return crypto.verify(
    null,
    Buffer.from(canonicalJson, "utf8"),
    key,
    Buffer.from(signatureBase64, "base64"),
  );
}
