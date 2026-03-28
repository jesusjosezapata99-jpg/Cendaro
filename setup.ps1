# Cendaro Developer Setup — Core Architecture Bridging
# Execute from the root directory of the cloned public repository

param(
    [string]$OpsRepoUrl = "git@github.com:cendaro/cendaro-ops.git"
)

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
