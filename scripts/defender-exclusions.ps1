<#
.SYNOPSIS
    Windows Defender exclusions for the Cendaro ERP monorepo (dev-only).

.DESCRIPTION
    Adds Windows Defender real-time scan exclusions for the paths that
    Turbopack/pnpm hammer with tens of thousands of small file reads/writes
    during dev (node_modules, .next, .turbo, pnpm store). On Windows,
    Defender's real-time protection scanning every .ts/.js chunk write is a
    documented major source of slow cold starts and sluggish HMR.

    THIS SCRIPT REQUIRES AN ELEVATED (ADMINISTRATOR) POWERSHELL SESSION.
    It is NOT executed automatically by Claude Code or any dev script —
    the user reviews it and decides whether to run it.

    Effect is dev-workstation-only: it does not touch app code, dependencies,
    or production. Revert with scripts/defender-exclusions.ps1 -Revert.

.EXAMPLE
    # From an elevated PowerShell prompt:
    pwsh -File scripts\defender-exclusions.ps1
    pwsh -File scripts\defender-exclusions.ps1 -Revert
#>
param(
    [switch]$Revert
)

# Must run elevated — Add-MpPreference fails silently or errors without admin.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Ejecuta este script desde PowerShell como Administrador."
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot

$paths = @(
    (Join-Path $repoRoot 'node_modules'),
    (Join-Path $repoRoot 'apps\erp\node_modules'),
    (Join-Path $repoRoot 'apps\erp\.next'),
    (Join-Path $repoRoot 'packages\api\node_modules'),
    (Join-Path $repoRoot 'packages\auth\node_modules'),
    (Join-Path $repoRoot 'packages\db\node_modules'),
    (Join-Path $repoRoot 'packages\ui\node_modules'),
    (Join-Path $repoRoot 'packages\validators\node_modules'),
    (Join-Path $repoRoot 'tooling'),
    "$env:LOCALAPPDATA\pnpm\store"
)

if ($Revert) {
    foreach ($p in $paths) {
        try {
            Remove-MpPreference -ExclusionPath $p -ErrorAction Stop
            Write-Host "Eliminada exclusion: $p"
        } catch {
            Write-Warning "No se pudo eliminar la exclusion: $p"
        }
    }
    exit 0
}

foreach ($p in $paths) {
    if (-not (Test-Path $p)) {
        Write-Host "  (skip, no existe: $p)"
        continue
    }
    try {
        Add-MpPreference -ExclusionPath $p -ErrorAction Stop
        Write-Host "Anadida exclusion: $p"
    } catch {
        Write-Warning "Fallo anadiendo exclusion: $p — $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Listo. Verifica con: Get-MpPreference | Select-Object -ExpandProperty ExclusionPath"
