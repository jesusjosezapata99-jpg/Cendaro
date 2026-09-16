param(
  [string[]] $Tables = @(
    "user_profile", "workspace", "organization", "permission", "role_permission",
    "product", "customer"
  ),
  # SECURITY DEFINER functions that are STABLE and take no arguments, so a GET
  # through PostgREST is a pure read with no side effects.
  [string[]] $Rpcs = @("is_elevated", "get_user_role", "is_admin_or_owner")
)

# Probes what the PUBLIC anon key (shipped to every browser) can reach through
# Supabase's REST API. Reads the key from the repo-root .env without printing it.
#
# Tables — HEAD + `Prefer: count=exact` + `limit=0`, so only a row COUNT comes
# back, never row data:
#   206 + Content-Range */N (N > 0) → table readable by anyone        (EXPOSED)
#   200 + Content-Range */0         → RLS filters every row for anon  (protected by RLS)
#   401 / 403                       → no privilege at all             (BLOCKED)
#
# RPC — GET /rest/v1/rpc/<name> (PostgREST allows GET only for STABLE/IMMUTABLE):
#   200                             → callable with the anon key      (EXPOSED)
#   401 / 403 / 404                 → no EXECUTE / not exposed        (BLOCKED)

$envPath = Join-Path $PSScriptRoot "..\..\..\.env"
$envLines = Get-Content $envPath
$url = (($envLines | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' }) -split '=', 2)[1].Trim('"')
$anon = (($envLines | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' }) -split '=', 2)[1].Trim('"')
$headers = @{ apikey = $anon; Authorization = "Bearer $anon" }

$exposed = 0
foreach ($t in $Tables) {
  $r = Invoke-WebRequest "$url/rest/v1/$t`?select=id&limit=0" -Method Head `
    -Headers ($headers + @{ Prefer = 'count=exact' }) `
    -UseBasicParsing -SkipHttpErrorCheck
  # PowerShell 7 returns header values as string[] — take the first element.
  $range = @($r.Headers['Content-Range'])[0]
  $count = if ("$range" -match '/(\d+)$') { [int]$Matches[1] } else { $null }
  # Fail closed: anything not provably blocked or provably empty counts as exposed.
  $verdict = if ($r.StatusCode -in 401, 403) { 'BLOCKED' }
             elseif ($null -ne $count -and $count -eq 0) { 'RLS-FILTERED' }
             elseif ($null -ne $count -and $count -gt 0) { $exposed++; 'EXPOSED' }
             else { $exposed++; "UNKNOWN(status=$($r.StatusCode)) — treated as EXPOSED" }
  "{0,-18} status={1} content-range={2,-8} {3}" -f $t, $r.StatusCode, $range, $verdict
}
"SUMMARY: $exposed of $($Tables.Count) tables readable with the public anon key"

$callable = 0
foreach ($f in $Rpcs) {
  $r = Invoke-WebRequest "$url/rest/v1/rpc/$f" -Method Get -Headers $headers `
    -UseBasicParsing -SkipHttpErrorCheck
  # Fail closed: only an explicit denial or a missing endpoint counts as blocked.
  $verdict = if ($r.StatusCode -in 401, 403, 404) { 'BLOCKED' }
             elseif ($r.StatusCode -eq 200) { $callable++; 'EXPOSED' }
             else { $callable++; "UNKNOWN(status=$($r.StatusCode)) — treated as EXPOSED" }
  "rpc/{0,-14} status={1} {2}" -f $f, $r.StatusCode, $verdict
}
"SUMMARY: $callable of $($Rpcs.Count) SECURITY DEFINER functions callable with the public anon key"
