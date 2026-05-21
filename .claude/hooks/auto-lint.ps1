# auto-lint.ps1 — Claude Code Async PostToolUse Hook
# Runs pnpm lint asynchronously after file writes to catch errors early.
# Input: JSON on stdin with tool_name and tool_input from PostToolUse event.

$hookInput = [Console]::In.ReadToEnd() | ConvertFrom-Json

# Extract file path from the tool input
$filePath = $null
if ($hookInput.tool_input) {
    $filePath = $hookInput.tool_input.file_path
    if (-not $filePath) { $filePath = $hookInput.tool_input.target_file }
}

# Only lint TypeScript/JavaScript files
if ($filePath -and ($filePath -match '\.(ts|tsx|js|jsx)$')) {
    try {
        $lintOutput = & pnpm lint --quiet 2>&1 | Out-String
        $exitCode = $LASTEXITCODE

        if ($exitCode -ne 0) {
            # Truncate lint output to avoid JSON bloat
            if ($lintOutput.Length -gt 2000) {
                $lintOutput = $lintOutput.Substring(0, 2000) + "`n[... truncated ...]"
            }
            @{
                reason = "[auto-lint] Lint errors detected after writing $filePath :`n$lintOutput"
            } | ConvertTo-Json -Depth 3
        } else {
            exit 0
        }
    } catch {
        # Lint failed to run — don't block Claude
        exit 0
    }
} else {
    exit 0
}