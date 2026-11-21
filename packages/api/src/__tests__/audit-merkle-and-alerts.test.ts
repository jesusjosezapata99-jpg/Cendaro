import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  buildSentryEnvelope,
  buildSlackAlertPayload,
  parseSentryDsn,
  sendMonitorAlert,
} from "../../../../scripts/checks/prod/alert-monitor.mjs";
import {
  buildNotarizationCheckpoint,
  canonicalAuditLeafString,
  computeMerkleRoot,
  generateMerkleInclusionProof,
  hashMerkleLeaf,
  hashMerkleNode,
  signCheckpointEd25519,
  verifyCheckpointEd25519,
  verifyLinearChainWindow,
  verifyMerkleInclusionProof,
} from "../../../../scripts/checks/prod/audit-merkle-lib.mjs";

describe("Audit Log RFC 6962 Merkle Notarization & Alerting", () => {
  it("enforces RFC 6962 0x00 / 0x01 domain separation between leaves and internal nodes", () => {
    const leafA = hashMerkleLeaf("ws-1:1:GENESIS:aaaa");
    const leafB = hashMerkleLeaf("ws-1:2:aaaa:bbbb");
    const internalNode = hashMerkleNode(leafA, leafB);

    // Forged leaf attempting to concatenate raw left || right bytes must NOT collide with internal node
    const forgedPayload = Buffer.concat([
      Buffer.from(leafA, "hex"),
      Buffer.from(leafB, "hex"),
    ]).toString("utf8");
    expect(hashMerkleLeaf(forgedPayload)).not.toBe(internalNode);
  });

  it("promotes odd trailing leaves without duplication (CVE-2012-2459 defense) and verifies inclusion proofs", () => {
    const rows = [
      { workspaceId: "ws-a", seq: 1, prevHash: "GENESIS", chainHash: "h1" },
      { workspaceId: "ws-a", seq: 2, prevHash: "h1", chainHash: "h2" },
      { workspaceId: "ws-a", seq: 3, prevHash: "h2", chainHash: "h3" },
      { workspaceId: "ws-b", seq: 4, prevHash: "GENESIS", chainHash: "b1" },
      { workspaceId: "ws-b", seq: 5, prevHash: "b1", chainHash: "b2" },
    ];
    const leaves = rows.map((r) => canonicalAuditLeafString(r));
    const root = computeMerkleRoot(leaves);

    // Duplicate trailing leaf MUST yield a different Merkle root
    const duplicatedLeaves = [...leaves, leaves[4] ?? ""];
    expect(computeMerkleRoot(duplicatedLeaves)).not.toBe(root);

    // Inclusion proof for every index (even and odd) verifies against root and fails if tampered
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i] ?? "";
      const proof = generateMerkleInclusionProof(leaves, i);
      expect(verifyMerkleInclusionProof(leaf, proof, root)).toBe(true);
      expect(verifyMerkleInclusionProof(`${leaf}:tampered`, proof, root)).toBe(
        false,
      );
    }
  });

  it("detects broken linear prev_hash -> chain_hash links and signs valid checkpoints with Ed25519", () => {
    const validRows = [
      { workspaceId: "ws-1", seq: 10, prevHash: "GENESIS", chainHash: "c10" },
      { workspaceId: "ws-1", seq: 11, prevHash: "c10", chainHash: "c11" },
    ];
    const checkpoint = buildNotarizationCheckpoint({
      windowStart: "2026-11-13T00:00:00.000Z",
      windowEnd: "2026-11-14T00:00:00.000Z",
      rows: validRows,
    });

    expect(checkpoint.statement.rowCount).toBe(2);
    expect(checkpoint.checkpointDigest).toMatch(/^[0-9a-f]{64}$/);

    // Ed25519 sign & verify
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const privPem = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();

    const sig = signCheckpointEd25519(checkpoint.canonicalJson, privPem);
    expect(verifyCheckpointEd25519(checkpoint.canonicalJson, sig, pubPem)).toBe(
      true,
    );
    expect(
      verifyCheckpointEd25519(`${checkpoint.canonicalJson} `, sig, pubPem),
    ).toBe(false);

    // Tampered chain link throws
    const tamperedRows = [
      { workspaceId: "ws-1", seq: 10, prevHash: "GENESIS", chainHash: "c10" },
      { workspaceId: "ws-1", seq: 11, prevHash: "WRONG", chainHash: "c11" },
    ];
    expect(verifyLinearChainWindow(tamperedRows).valid).toBe(false);
    expect(() =>
      buildNotarizationCheckpoint({
        windowStart: "2026-11-13T00:00:00.000Z",
        windowEnd: "2026-11-14T00:00:00.000Z",
        rows: tamperedRows,
      }),
    ).toThrow(/broken link/);
  });

  it("parses Sentry DSNs and dispatches Slack + Sentry Envelope alerts without customer PII", async () => {
    const parsed = parseSentryDsn(
      "https://pub12345@o999.ingest.us.sentry.io/4500001",
    );
    expect(parsed).toEqual({
      endpoint: "https://o999.ingest.us.sentry.io/api/4500001/envelope/",
      publicKey: "pub12345",
      dsn: "https://pub12345@o999.ingest.us.sentry.io/4500001",
    });

    const envelope = buildSentryEnvelope({
      dsn: parsed?.dsn ?? "",
      title: "Invariant drift",
      checkSuite: "financial-invariants",
      violations: [{ invariant: "negative_stock", violations: 2 }],
    });
    expect(envelope.split("\n").length).toBeGreaterThanOrEqual(3);
    expect(envelope).toContain("negative_stock");

    const slack = buildSlackAlertPayload({
      title: "Invariant drift",
      checkSuite: "financial-invariants",
      violations: [{ invariant: "negative_stock", violations: 2 }],
    });
    expect(JSON.stringify(slack)).toContain("negative_stock");

    vi.stubEnv("SLACK_MONITOR_WEBHOOK_URL", "https://hooks.slack.test/T0/B0/X");
    vi.stubEnv(
      "SENTRY_MONITOR_DSN",
      "https://pub12345@o999.ingest.us.sentry.io/4500001",
    );

    const mockFetch: typeof fetch = vi.fn(() =>
      Promise.resolve(new Response("ok", { status: 200 })),
    );
    const result = await sendMonitorAlert({
      title: "Test alert",
      checkSuite: "financial-invariants",
      violations: [{ invariant: "negative_stock", violations: 1 }],
      fetchImpl: mockFetch,
    });

    expect(result).toEqual({ slackSent: true, sentrySent: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.unstubAllEnvs();
  });
});
