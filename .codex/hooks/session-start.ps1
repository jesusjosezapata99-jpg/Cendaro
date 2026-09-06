# session-start.ps1 — Claude Code SessionStart Hook
# Injects the graphify knowledge graph summary into Claude's context at session start.
# SessionStart hooks do NOT receive stdin — they only output JSON.

# Resolve project dir
$projectDir = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }

$reportPath = Join-Path $projectDir "graphify-out\GRAPH_REPORT.md"

if (Test-Path $reportPath) {
    # Read the full report
    $content = Get-Content $reportPath -Raw -Encoding UTF8

    # Extract only the high-value sections to keep context tight
    $lines = $content -split "`n"
    $summary = New-Object System.Collections.ArrayList
    $capture = $false

    foreach ($line in $lines) {
        # Start capturing on these sections
        if ($line -match '^# Graph Report') { $capture = $true }
        if ($line -match '^## Corpus') { $capture = $true }
        if ($line -match '^## Summary') { $capture = $true }
        if ($line -match '^## God Nodes') { $capture = $true }

        # Stop capturing on these sections
        if ($line -match '^## Community Hubs') { $capture = $false }
        if ($line -match '^## Surprising') { $capture = $false }
        if ($line -match '^## Communities$') { $capture = $false }

        if ($capture) {
            [void]$summary.Add($line)
        }
    }

    $summaryText = ($summary -join "`n").Trim()

    # Safety truncation
    if ($summaryText.Length -gt 3000) {
        $summaryText = $summaryText.Substring(0, 3000)
    }

    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

    $msg = "[graphify] Architecture knowledge graph loaded. " + $summaryText

    # Build output — supports both legacy reason and official hookSpecificOutput schema
    $output = @{
        reason = $msg
        hookSpecificOutput = @{
            hookEventName = "SessionStart"
            additionalContext = $msg
        }
    }
    $output | ConvertTo-Json -Depth 4
    exit 0
}

exit 0