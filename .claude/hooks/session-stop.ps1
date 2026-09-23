# session-stop.ps1 — Claude Code Stop hook (session-end verification)
# PLAN-2026-09-SECURITY-REMEDIATION F10.3.
#
# Last look at what the session changed, before the work is handed over:
#   1. secret-shaped strings that must never reach the repository,
#   2. debug leftovers (console.log / debugger) in application code.
#
# Advisory by design: it always exits 0 and only prints, so it can never
# strand a session. The blocking checks live in CI (lint, typecheck, tests).

$ErrorActionPreference = 'SilentlyContinue'
[Console]::In.ReadToEnd() | Out-Null

$repo = $env:CLAUDE_PROJECT_DIR
if (-not $repo) { $repo = (Get-Location).Path }
Set-Location $repo

# Tracked + untracked changes, excluding deletions.
$changed = @(git diff --name-only --diff-filter=d HEAD 2>$null) +
           @(git ls-files --others --exclude-standard 2>$null)
$changed = $changed | Where-Object { $_ } | Sort-Object -Unique
if (-not $changed) { exit 0 }

# Token shapes: Supabase service keys, JWTs, OpenAI/GitHub tokens, private keys.
$secretPatterns = @(
    'service_role',
    'sb_secret_[A-Za-z0-9_\-]{16,}',
    'eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.',
    'sk-[A-Za-z0-9]{32,}',
    'gh[pousr]_[A-Za-z0-9]{30,}',
    'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'
)

$secretHits = @()
$debugHits = @()

foreach ($file in $changed) {
    $full = Join-Path $repo $file
    if (-not (Test-Path $full -PathType Leaf)) { continue }
    if ($file -match '\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|xlsx|lock|lockb)$') { continue }
    if ((Get-Item $full).Length -gt 1MB) { continue }

    $content = Get-Content $full -Raw
    if (-not $content) { continue }

    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) { $secretHits += "$file  ($pattern)"; break }
    }

    # Debug leftovers only matter in shipped source, not in tests or scripts.
    if ($file -match '^(apps|packages)/.*\.(ts|tsx)$' -and $file -notmatch '\.test\.tsx?$') {
        if ($content -match '(?m)^\s*(console\.log|debugger)\b') { $debugHits += $file }
    }
}

if ($secretHits) {
    Write-Host "[session-stop] Possible secrets in changed files - review before committing:"
    $secretHits | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }
}
if ($debugHits) {
    Write-Host "[session-stop] Debug statements left in source:"
    $debugHits | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }
}

exit 0
