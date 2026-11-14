export interface AuditLeafRow {
  workspaceId: string | null;
  seq: number | string | bigint;
  prevHash: string;
  chainHash: string;
}

export interface MerkleProofStep {
  side: "left" | "right";
  hash: string;
}

export interface BrokenChainLink {
  workspaceId: string;
  seq: string;
  expectedPrev: string;
  actualPrev: string;
}

export interface WorkspaceChainTip {
  workspaceId: string;
  maxSeq: string;
  tipChainHash: string;
}

export interface NotarizationStatement {
  schemaVersion: number;
  algorithm: string;
  windowStart: string;
  windowEnd: string;
  rowCount: number;
  minSeq: string | null;
  maxSeq: string | null;
  merkleRoot: string;
  workspaceTips: WorkspaceChainTip[];
}

export function canonicalAuditLeafString(row: AuditLeafRow): string;
export function hashMerkleLeaf(payload: string): string;
export function hashMerkleNode(leftHex: string, rightHex: string): string;
export function computeMerkleRoot(
  leafPayloads: string[],
  emptyMeta?: { windowStart?: string; windowEnd?: string },
): string;
export function generateMerkleInclusionProof(
  leafPayloads: string[],
  leafIndex: number,
): MerkleProofStep[];
export function verifyMerkleInclusionProof(
  leafPayload: string,
  proof: MerkleProofStep[],
  expectedRoot: string,
): boolean;
export function verifyLinearChainWindow(
  rows: AuditLeafRow[],
  priorWorkspaceTips?: Map<string, string>,
): {
  valid: boolean;
  brokenLinks: BrokenChainLink[];
  workspaceTips: WorkspaceChainTip[];
};
export function buildNotarizationCheckpoint(opts: {
  windowStart: string;
  windowEnd: string;
  rows: AuditLeafRow[];
}): {
  statement: NotarizationStatement;
  canonicalJson: string;
  checkpointDigest: string;
};
export function signCheckpointEd25519(
  canonicalJson: string,
  privateKeyPem: string,
): string;
export function verifyCheckpointEd25519(
  canonicalJson: string,
  signatureBase64: string,
  publicKeyPem: string,
): boolean;
