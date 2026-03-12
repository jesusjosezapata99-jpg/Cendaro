---
description: "Epistemic memory audit — prunes stale KIs by cross-referencing monorepo dependencies against project-local knowledge files, archiving outdated rules and heuristics."
---

# Memory Audit Workflow

This workflow performs an epistemic prune of the project-local knowledge files to remove or archive rules, heuristics, and KIs that reference deprecated packages or outdated architectural patterns.

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

### 4. List all project-local knowledge files

// turbo

```powershell
Get-ChildItem -Path ".gemini\knowledge" -Recurse -File | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
```

### 5. Cross-reference KIs against active dependencies

// turbo

For each knowledge file, read its content and check for references to packages NOT in the active dependency set collected in Step 3. Flag any file that references:

- Packages no longer in any `package.json`
- Deprecated architectural patterns (e.g., references to Zustand, Redux, Jotai which are banned)
- Outdated version-specific workarounds for packages that have been upgraded
- Incorrect hook configurations or script names that no longer exist

Also cross-reference:

- `.agents/skills/omni-epistemic-memory/error-log.md` — flag entries referencing removed packages
- `.gemini/rules.md` Error Prevention Matrix — flag rows referencing deprecated tooling

### 6. Archive stale KIs

// turbo

- Move flagged knowledge files to `.gemini\knowledge\_archived\`
- Preserve original timestamps and metadata
- Do NOT delete — always archive for auditability

```powershell
$archiveDir = ".gemini\knowledge\_archived"
if (-not (Test-Path $archiveDir)) { New-Item -ItemType Directory -Path $archiveDir -Force }
# Move-Item -Path <flagged-file> -Destination $archiveDir
```

### 7. Generate audit log

// turbo

Write a timestamped audit report to `.gemini\knowledge\_audits\audit-YYYY-MM-DD.md` containing:

- Total knowledge files scanned
- Files archived (with reasons)
- Files retained
- Active dependency snapshot
- Recommendations for manual review

```powershell
$auditDir = ".gemini\knowledge\_audits"
if (-not (Test-Path $auditDir)) { New-Item -ItemType Directory -Path $auditDir -Force }
$date = Get-Date -Format "yyyy-MM-dd"
# Write audit content to "$auditDir\audit-$date.md"
```

### 8. Update state.md

// turbo

After the audit completes, prepend a new entry to `.gemini\knowledge\state.md` Progress Log documenting:

- Date and audit summary
- Files archived vs retained
- Update the "Knowledge Freshness" section with today's date for all verified files

### 9. Output summary

// turbo

Print a concise summary of changes to the terminal.
