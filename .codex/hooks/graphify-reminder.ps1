# graphify-reminder.ps1 — Claude Code Hook
# Event: PreToolUse (Bash|PowerShell) — injects knowledge graph context when searching.
# Output format: JSON { "hookSpecificOutput": { "additionalContext": "..." } }

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rawInput = [Console]::In.ReadToEnd()
$cmd = ""

if ($rawInput) {
    try {
        $hookInput = $rawInput | ConvertFrom-Json
        if ($hookInput.tool_input -and $hookInput.tool_input.command) {
            $cmd = $hookInput.tool_input.command
        } elseif ($hookInput.command) {
            $cmd = $hookInput.command
        }
    } catch {
        # Silent fallback
    }
}

# Resolve project dir: prefer Claude's env var, fallback to cwd
$projectDir = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }

$graphPath  = Join-Path $projectDir "graphify-out\graph.json"
$reportPath = Join-Path $projectDir "graphify-out\GRAPH_REPORT.md"

if ((Test-Path $graphPath) -or (Test-Path $reportPath)) {
    # Check if command is a file search / grepping command
    $isSearch = $false
    if ($cmd -match '(grep|rg\s|ripgrep|findstr|find\s|fd\s|ack\s|ag\s)') {
        $isSearch = $true
    }

    if ($isSearch -or (-not $cmd)) {
        $context = 'graphify: knowledge graph at graphify-out/. For focused questions, run `graphify query \"<question>\"` (scoped subgraph, usually much smaller than GRAPH_REPORT.md) instead of grepping raw files. Read GRAPH_REPORT.md only for broad architecture context.'
        @{
            reason = $context
            hookSpecificOutput = @{
                hookEventName = "PreToolUse"
                additionalContext = $context
            }
        } | ConvertTo-Json -Compress
        exit 0
    }
}

# No reminder needed or graph not found — exit silently
exit 0