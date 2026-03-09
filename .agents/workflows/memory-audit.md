---
description: "Epistemic memory audit — prunes stale KIs by cross-referencing monorepo dependencies against knowledge items, archiving outdated rules and heuristics."
---

# Memory Audit Workflow

This workflow performs an epistemic prune of the global Knowledge Items to remove or archive rules, heuristics, and KIs that reference deprecated packages or outdated architectural patterns.

## Steps

### 1. Read the monorepo workspace manifest

// turbo

```bash
cat pnpm-workspace.yaml
```

### 2. Collect all `package.json` dependency manifests

// turbo

```bash
find apps packages tooling -name "package.json" -not -path "*/node_modules/*" | head -50
```

### 3. Parse installed dependencies and devDependencies

// turbo

```bash
node -e "
const fs = require('fs');
const glob = require('glob');
const files = glob.sync('{apps,packages,tooling}/**/package.json', { ignore: '**/node_modules/**' });
const deps = new Set();
files.forEach(f => {
  const pkg = JSON.parse(fs.readFileSync(f, 'utf8'));
  Object.keys(pkg.dependencies || {}).forEach(d => deps.add(d));
  Object.keys(pkg.devDependencies || {}).forEach(d => deps.add(d));
});
console.log(JSON.stringify([...deps].sort(), null, 2));
"
```

### 4. List all Knowledge Item artifact files

// turbo

```bash
ls -R ~/.gemini/antigravity/knowledge/
```

### 5. Cross-reference KIs against active dependencies

For each KI artifact, read its content and check for references to packages NOT in the active dependency set collected in Step 3. Flag any KI that references:

- Packages no longer in any `package.json`
- Deprecated architectural patterns (e.g., references to Zustand, Redux, Jotai which are banned)
- Outdated version-specific workarounds for packages that have been upgraded

### 6. Archive stale KIs

- Move flagged KI files to `~/.gemini/antigravity/knowledge/_archived/`
- Preserve original timestamps and metadata
- Do NOT delete — always archive for auditability

### 7. Generate audit log

Write a timestamped audit report to `brain/memory-audits/audit-YYYY-MM-DD.md` containing:

- Total KIs scanned
- KIs archived (with reasons)
- KIs retained
- Active dependency snapshot
- Recommendations for manual review

### 8. Output summary

Print a concise summary of changes to the terminal.
