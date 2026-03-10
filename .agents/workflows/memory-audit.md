---
description: "Epistemic memory audit — prunes stale KIs by cross-referencing monorepo dependencies against knowledge items, archiving outdated rules and heuristics."
---

# Memory Audit Workflow

This workflow performs an epistemic prune of the global Knowledge Items to remove or archive rules, heuristics, and KIs that reference deprecated packages or outdated architectural patterns.

> **Protocol**: This workflow follows the `omni-epistemic-memory` skill. Read `.agents/skills/omni-epistemic-memory/SKILL.md` before executing.

## Steps

### 1. Read the monorepo workspace manifest

// turbo

```powershell
Get-Content pnpm-workspace.yaml
```

### 2. Collect all `package.json` dependency manifests

// turbo

```powershell
Get-ChildItem -Path apps, packages, tooling -Filter "package.json" -Recurse | Where-Object { $_.FullName -notmatch "node_modules" } | Select-Object -First 50 -ExpandProperty FullName
```

### 3. Parse installed dependencies and devDependencies

// turbo

```powershell
$files = Get-ChildItem -Path apps, packages, tooling -Filter "package.json" -Recurse | Where-Object { $_.FullName -notmatch "node_modules" }
$deps = @{}
foreach ($f in $files) {
  $pkg = Get-Content $f.FullName | ConvertFrom-Json
  if ($pkg.dependencies) { $pkg.dependencies.PSObject.Properties | ForEach-Object { $deps[$_.Name] = $true } }
  if ($pkg.devDependencies) { $pkg.devDependencies.PSObject.Properties | ForEach-Object { $deps[$_.Name] = $true } }
}
$deps.Keys | Sort-Object | ConvertTo-Json
```

### 4. List all Knowledge Item artifact files

// turbo

```powershell
Get-ChildItem -Path "$env:USERPROFILE\.gemini\antigravity\knowledge" -Recurse -File | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
```

### 5. Cross-reference KIs against active dependencies

// turbo

For each KI artifact, read its content and check for references to packages NOT in the active dependency set collected in Step 3. Flag any KI that references:

- Packages no longer in any `package.json`
- Deprecated architectural patterns (e.g., references to Zustand, Redux, Jotai which are banned)
- Outdated version-specific workarounds for packages that have been upgraded
- Incorrect hook configurations or script names that no longer exist

### 6. Archive stale KIs

// turbo

- Move flagged KI files to `$env:USERPROFILE\.gemini\antigravity\knowledge\_archived\`
- Preserve original timestamps and metadata
- Do NOT delete — always archive for auditability

### 7. Generate audit log

// turbo

Write a timestamped audit report to `$env:USERPROFILE\.gemini\antigravity\brain\memory-audits\audit-YYYY-MM-DD.md` containing:

- Total KIs scanned
- KIs archived (with reasons)
- KIs retained
- Active dependency snapshot
- Recommendations for manual review

### 8. Output summary

// turbo

Print a concise summary of changes to the terminal.
