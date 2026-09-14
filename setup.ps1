# Cendaro Developer Setup — Core Architecture Bridging
# ⚠ INTERNAL USE ONLY — This script requires access to the private cendaro-ops repository.
# External contributors do NOT need to run this script.
# Execute from the root directory of the cloned public repository.

param(
    [string]$OpsRepoUrl = $env:CENDARO_OPS_REPO_URL
)

if (-not $OpsRepoUrl) {
    Write-Warning "CENDARO_OPS_REPO_URL environment variable is not set and no -OpsRepoUrl argument was provided."
    Write-Warning "Internal tools sync skipped. External contributors can proceed normally without this step."
    exit 0
}

Write-Host "🔧 Cendaro Developer Setup" -ForegroundColor Cyan

# 1. Clone private ops repo to temp
$tempDir = Join-Path $env:TEMP "cendaro-ops-$(Get-Random)"
git clone --depth 1 $OpsRepoUrl $tempDir

# 2. Copy agent config
if (Test-Path "$tempDir/.agents") {
    Copy-Item -Recurse -Force "$tempDir/.agents" "./.agents"
    Write-Host "✅ .agents/ installed" -ForegroundColor Green
}

if (Test-Path "$tempDir/.gemini") {
    Copy-Item -Recurse -Force "$tempDir/.gemini" "./.gemini"
    Write-Host "✅ .gemini/ installed" -ForegroundColor Green
}

# 3. Cleanup
Remove-Item -Recurse -Force $tempDir
Write-Host "🏁 Setup complete!" -ForegroundColor Green
