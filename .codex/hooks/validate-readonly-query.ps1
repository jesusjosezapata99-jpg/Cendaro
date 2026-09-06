# validate-readonly-query.ps1
# PreToolUse hook for supabase-guard agent
# Blocks SQL write operations, allows SELECT queries only
# Exit 0 = allow, Exit 2 = block with feedback

$ErrorActionPreference = 'SilentlyContinue'

# Read JSON input from stdin
$rawInput = $input | Out-String

if (-not $rawInput) {
    exit 0
}

try {
    $json = $rawInput | ConvertFrom-Json
    $command = $json.tool_input.command
} catch {
    exit 0
}

if (-not $command) {
    exit 0
}

# SQL write operations pattern (case-insensitive)
$writePattern = '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE)\b'

if ($command -match $writePattern) {
    Write-Error "BLOCKED: Write operation detected. The supabase-guard agent has read-only access. Only SELECT queries are allowed. Detected keyword: $($Matches[0])"
    exit 2
}

# Also block dangerous shell commands
$dangerousPattern = '\b(rm\s+-rf|rmdir|del\s+/|Remove-Item|supabase\s+db\s+push|supabase\s+migration\s+up)\b'

if ($command -match $dangerousPattern) {
    Write-Error "BLOCKED: Destructive operation detected. The supabase-guard agent cannot modify the database or filesystem."
    exit 2
}

exit 0