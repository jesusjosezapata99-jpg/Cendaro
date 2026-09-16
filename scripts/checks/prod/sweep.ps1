param(
  [Parameter(Mandatory)] [string] $Session,
  [Parameter(Mandatory)] [string] $Base,
  [Parameter(Mandatory)] [string[]] $Routes
)

# Sweep v2 — per route: full navigation, then report
#   * tRPC calls with ANY non-200 status (207 = partial batch failure)
#   * any resource (script, css, font, image, fetch) with status >= 400
#   * console errors + warnings (CSP violations, hydration, React warnings)
#   * uncaught page errors, error-boundary text
# Buffers are cleared before each route so every finding is attributable.

$probe = @'
JSON.stringify((() => {
  const res = performance.getEntriesByType("resource");
  const trpc = res.filter(r => r.name.includes("/api/trpc/"));
  const trpcBad = trpc.filter(r => r.responseStatus !== 200).map(r => decodeURIComponent(r.name.split("/api/trpc/")[1].split("?")[0]).slice(0, 120) + " -> " + r.responseStatus);
  const resBad = res.filter(r => !r.name.includes("/api/trpc/") && r.responseStatus >= 400).map(r => r.name.slice(0, 140) + " -> " + r.responseStatus);
  const nav = performance.getEntriesByType("navigation")[0];
  const text = document.body.innerText;
  const boundary = /Algo sali[oó] mal|Something went wrong|Application error|Error interno|No se pudo cargar|Unhandled Runtime Error/i.exec(text);
  return {
    url: location.pathname + location.search,
    ttfb: nav ? Math.round(nav.responseStart) : null,
    trpcN: trpc.length,
    trpcMaxMs: trpc.reduce((m, r) => Math.max(m, Math.round(r.duration)), 0),
    trpcBad, resBad,
    boundary: boundary ? boundary[0] : null
  };
})())
'@

$summary = [ordered]@{ routes = 0; routesWithIssues = 0 }
foreach ($r in $Routes) {
  agent-browser --session $Session network requests --clear | Out-Null
  agent-browser --session $Session console --clear | Out-Null
  agent-browser --session $Session errors --clear | Out-Null
  agent-browser --session $Session open "$Base$r" | Out-Null
  agent-browser --session $Session wait --load networkidle | Out-Null
  agent-browser --session $Session wait 2000 | Out-Null

  $p = (agent-browser --session $Session eval $probe | ConvertFrom-Json) | ConvertFrom-Json
  $net = (agent-browser --session $Session network requests --json | ConvertFrom-Json).data.requests
  $netBad = @($net | Where-Object { $s = if ($null -ne $_.status) { $_.status } elseif ($_.response) { $_.response.status } else { 0 }; [int]$s -ge 400 } | ForEach-Object { "$($_.method) $($_.url.Substring(0, [Math]::Min(130, $_.url.Length))) -> $($_.status)" })
  $cons = (agent-browser --session $Session console --json | ConvertFrom-Json).data.messages
  $consBad = @($cons | Where-Object { $_.type -match 'error|warn' } | ForEach-Object { "[$($_.type)] " + (($_.text -replace '\s+', ' ').Substring(0, [Math]::Min(220, ($_.text -replace '\s+', ' ').Length))) })
  $errs = (agent-browser --session $Session errors --json | ConvertFrom-Json).data.errors
  $errBad = @($errs | ForEach-Object { (($_.text -split "`n")[0]).Substring(0, [Math]::Min(200, (($_.text -split "`n")[0]).Length)) })

  $issues = @($p.trpcBad) + @($p.resBad) + $netBad + $consBad + $errBad + @($(if ($p.boundary) { "BOUNDARY: $($p.boundary)" }))
  $issues = @($issues | Where-Object { $_ } | Select-Object -Unique)
  $summary.routes++
  $flag = if ($issues.Count) { $summary.routesWithIssues++; 'ISSUES' } else { 'OK' }
  Write-Output ("{0,-6} {1}  (ttfb {2}ms, trpc {3} calls, max {4}ms)" -f $flag, $p.url, $p.ttfb, $p.trpcN, $p.trpcMaxMs)
  $issues | Select-Object -First 8 | ForEach-Object { Write-Output "         - $_" }
}
Write-Output ("SUMMARY: {0} routes, {1} with issues" -f $summary.routes, $summary.routesWithIssues)
