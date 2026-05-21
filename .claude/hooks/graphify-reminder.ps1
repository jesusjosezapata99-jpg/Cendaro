# graphify-reminder.ps1 — Claude Code Hook
# Event: PreToolUse (Bash|PowerShell) — injects knowledge graph context.
# Output format: JSON { "reason": "..." } adds context WITHOUT blocking the tool call.

$hookInput = [Console]::In.ReadToEnd() | ConvertFrom-Json

# Resolve project dir: prefer Claude's env var, fallback to cwd
$projectDir = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }

$graphPath   = Join-Path $projectDir "graphify-out\graph.json"
$reportPath  = Join-Path $projectDir "graphify-out\GRAPH_REPORT.md"

if ((Test-Path $graphPath) -or (Test-Path $reportPath)) {
    @{
        reason = "[graphify] Knowledge graph available. Read graphify-out/GRAPH_REPORT.md for architecture context (god nodes, communities, cross-module paths) BEFORE grepping files."
    } | ConvertTo-Json -Compress
    exit 0
}

# Graph not found — exit silently, do not block
exit 0