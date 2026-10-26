#!/usr/bin/env node
// Removes stale entries from the graphify knowledge graph.
//
// `graphify update` adds and refreshes nodes but never deletes them, so the graph
// keeps nodes for files that were deleted, that only exist on another branch, or
// that .graphifyignore excludes. Those ghost nodes skew god nodes and query results.
// This script drops them (and their edges) from graphify-out/graph.json and drops
// the matching entries from graphify-out/manifest.json, so a file that reappears
// (for example after switching back to its branch) is extracted again.
//
// Run from the repo root, between `graphify update .` and `graphify cluster-only .`
// (the Husky post-checkout/post-merge/post-commit hooks do this). `--dry` only reports.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dry = process.argv.includes("--dry");
const graphPath = path.join(root, "graphify-out", "graph.json");
const manifestPath = path.join(root, "graphify-out", "manifest.json");

if (!existsSync(graphPath)) {
  console.log("[graphify-prune] no graph.json, nothing to do");
  process.exit(0);
}

const ignore = readFileSync(path.join(root, ".graphifyignore"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const ignoredDirs = ignore.filter((p) => p.endsWith("/")).map((p) => p.slice(0, -1));
const ignoredFiles = ignore.filter((p) => !p.endsWith("/") && !p.includes("*"));

const rootPosix = root.split(path.sep).join("/").toLowerCase();

/** Repo-relative POSIX path for a graphify source path, or "" when it has none. */
function toRelative(sourceFile) {
  if (!sourceFile) return "";
  const posix = String(sourceFile).split("\\").join("/");
  const idx = posix.toLowerCase().indexOf(`${rootPosix}/`);
  return idx >= 0 ? posix.slice(idx + rootPosix.length + 1) : posix.replace(/^\.\//, "");
}

/** Returns the reason a source path is stale, or null when it should stay. */
function staleReason(sourceFile) {
  const rel = toRelative(sourceFile);
  if (!rel) return null;
  if (ignoredDirs.includes(rel.split("/")[0]) || ignoredFiles.includes(rel)) return "ignored";
  if (!existsSync(path.join(root, rel))) return "missing";
  return null;
}

const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const removedIds = new Set();
const counts = { ignored: 0, missing: 0 };

const nodes = graph.nodes.filter((node) => {
  const reason = staleReason(node.source_file);
  if (!reason) return true;
  removedIds.add(node.id);
  counts[reason] += 1;
  return false;
});
const links = graph.links.filter(
  (link) => !removedIds.has(link.source) && !removedIds.has(link.target) && !staleReason(link.source_file),
);
const hyperedges = Array.isArray(graph.hyperedges)
  ? graph.hyperedges
      .map((h) => (Array.isArray(h.nodes) ? { ...h, nodes: h.nodes.filter((id) => !removedIds.has(id)) } : h))
      .filter((h) => !Array.isArray(h.nodes) || h.nodes.length >= 2)
  : graph.hyperedges;

let manifestRemoved = 0;
let manifest = null;
if (existsSync(manifestPath)) {
  const original = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest = Object.fromEntries(
    Object.entries(original).filter(([file]) => {
      const keep = !staleReason(file);
      if (!keep) manifestRemoved += 1;
      return keep;
    }),
  );
}

console.log(
  `[graphify-prune] nodes ${graph.nodes.length} -> ${nodes.length} ` +
    `(ignored ${counts.ignored}, missing ${counts.missing}), links ${graph.links.length} -> ${links.length}, ` +
    `manifest entries removed ${manifestRemoved}${dry ? " (dry run)" : ""}`,
);

if (!dry && removedIds.size + manifestRemoved + (graph.links.length - links.length) > 0) {
  writeFileSync(graphPath, JSON.stringify({ ...graph, nodes, links, hyperedges }));
  if (manifest) writeFileSync(manifestPath, JSON.stringify(manifest));
}
