param(
  [Parameter(Mandatory)] [string] $Session,
  [Parameter(Mandatory)] [string] $Base,
  [Parameter(Mandatory)] [string[]] $Routes
)

# Interactive-surface audit. For every page: install a mutation firewall
# (blocks any same-origin non-GET fetch — every tRPC mutation is a POST —
# so nothing can be written to production), then exercise the surfaces a
# user touches: every tab, the first row (detail sheet / navigation), the
# primary "Nuevo/Crear/Agregar" dialog (opened, never submitted), and on
# /dashboard the global shell (search Ctrl+K, notifications, user menu,
# period selector). Console / network / page errors are captured per page.

$guard = @'
(() => {
  if (window.__auditGuard) return "guard:already";
  const orig = window.fetch.bind(window);
  window.__blocked = [];
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : (input.url || String(input));
    const method = String(init.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    let sameOrigin = true;
    try { sameOrigin = new URL(url, location.href).origin === location.origin; } catch {}
    if (method !== "GET" && sameOrigin) {
      window.__blocked.push(method + " " + url.slice(0, 120));
      return Promise.reject(new Error("blocked by audit guard"));
    }
    return orig(input, init);
  };
  window.__auditGuard = true;
  return "guard:installed";
})()
'@

$actions = @'
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const esc = async () => { document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(500); };
  const dialogOpen = () => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].some(visible);
  const main = document.querySelector("main") || document.body;

  // 1) Every tab inside the page content
  const tabs = [...main.querySelectorAll('[role="tab"]')].filter(visible).slice(0, 8);
  for (const t of tabs) { t.click(); await sleep(900); }
  if (tabs.length) { tabs[0].click(); await sleep(600); }
  log.push("tabs:" + tabs.length);

  // 2) First data row -> detail sheet or navigation
  const startPath = location.pathname;
  // Lists render rows as UUID links (navigate) or .cursor-pointer blocks (sheet)
  const uuidLink = [...main.querySelectorAll("a[href]")].filter(visible).find((a) => /\/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(a.getAttribute("href") || ""));
  const clickable = [...main.querySelectorAll(".cursor-pointer, tbody tr, [role='row']")].filter(visible).find((el) => el.tagName !== "BUTTON" && !el.closest("header, nav, [role='toolbar'], [role='tablist']") && el.textContent.trim().length > 10);
  const row = uuidLink || clickable;
  if (row) {
    row.click();
    await sleep(2000);
    const nav = location.pathname !== startPath;
    log.push("row:" + (dialogOpen() ? "sheet" : nav ? "nav:" + location.pathname : "noop"));
    if (dialogOpen()) await esc();
    if (nav) { history.back(); await sleep(1800); }
  } else log.push("row:none");

  // 3) Primary create dialog (opened only, never submitted)
  const create = [...main.querySelectorAll("button, a")].filter(visible).find((b) => /^\s*(\+\s*)?(Nuev[oa]|Crear|Agregar|Añadir)\b/i.test(b.textContent || ""));
  if (create) {
    const before = location.pathname;
    create.click();
    await sleep(1500);
    log.push("create:" + (dialogOpen() ? "dialog" : location.pathname !== before ? "nav:" + location.pathname : "noop") + ":" + create.textContent.trim().slice(0, 30));
    if (dialogOpen()) await esc();
    if (location.pathname !== before) { history.back(); await sleep(1500); }
  } else log.push("create:none");

  // 4) Global shell surfaces (only once, on the dashboard)
  if (location.pathname === "/dashboard") {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    await sleep(900);
    const input = document.querySelector('[role="dialog"] input, [cmdk-input]');
    if (input) { input.focus(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(input, "a"); input.dispatchEvent(new Event("input", { bubbles: true })); await sleep(1800); }
    log.push("search:" + (input ? "opened" : "not-found"));
    await esc();
    const bell = [...document.querySelectorAll("header button")].find((b) => /notific/i.test((b.getAttribute("aria-label") || "") + b.textContent));
    if (bell) { bell.click(); await sleep(1500); await esc(); }
    log.push("notifications:" + (bell ? "opened" : "not-found"));
    const avatar = [...document.querySelectorAll("header button")].filter(visible).pop();
    if (avatar && avatar !== bell) { avatar.click(); await sleep(1000); await esc(); }
    log.push("userMenu:" + (avatar ? "opened" : "not-found"));
    const metrics = [...document.querySelectorAll("button,[role='tab'],[role='radio']")].find((b) => /^\s*M[eé]tricas\s*$/i.test(b.textContent || ""));
    if (metrics) { metrics.click(); await sleep(2500); const resumen = [...document.querySelectorAll("button,[role='tab'],[role='radio']")].find((b) => /^\s*Resumen\s*$/i.test(b.textContent || "")); resumen?.click(); await sleep(1000); }
    log.push("metricsView:" + (metrics ? "opened" : "not-found"));
  }
  return JSON.stringify({ path: location.pathname, actions: log, blocked: window.__blocked || [] });
})()
'@

$total = 0; $withIssues = 0
foreach ($r in $Routes) {
  agent-browser --session $Session open "$Base$r" | Out-Null
  agent-browser --session $Session wait --load networkidle | Out-Null
  agent-browser --session $Session wait 1500 | Out-Null
  agent-browser --session $Session network requests --clear | Out-Null
  agent-browser --session $Session console --clear | Out-Null
  agent-browser --session $Session errors --clear | Out-Null
  agent-browser --session $Session eval $guard | Out-Null

  $a = (agent-browser --session $Session eval $actions | ConvertFrom-Json) | ConvertFrom-Json
  agent-browser --session $Session wait 1500 | Out-Null

  $net = (agent-browser --session $Session network requests --json | ConvertFrom-Json).data.requests
  $netBad = @($net | Where-Object { [int]($_.status) -ge 400 -or ($_.url -like '*/api/trpc/*' -and $null -ne $_.status -and [int]$_.status -ne 200) } | ForEach-Object { "NET $($_.method) $($_.url.Substring(0, [Math]::Min(130, $_.url.Length))) -> $($_.status)" })
  $cons = (agent-browser --session $Session console --json | ConvertFrom-Json).data.messages
  $consBad = @($cons | Where-Object { $_.type -match 'error|warn' -and $_.text -notmatch 'audit guard' } | ForEach-Object { $t = ($_.text -replace '\s+', ' '); "CONSOLE[$($_.type)] $($t.Substring(0, [Math]::Min(220, $t.Length)))" })
  $errs = (agent-browser --session $Session errors --json | ConvertFrom-Json).data.errors
  $errBad = @($errs | Where-Object { $_.text -notmatch 'audit guard|AUDIT-POSITIVE-CONTROL' } | ForEach-Object { $l = ($_.text -split "`n")[0]; "PAGEERROR $($l.Substring(0, [Math]::Min(200, $l.Length)))" })
  $blocked = @($a.blocked | ForEach-Object { "BLOCKED-MUTATION $_" })

  $issues = @($netBad + $consBad + $errBad | Where-Object { $_ } | Select-Object -Unique)
  $total++
  $flag = if ($issues.Count) { $withIssues++; 'ISSUES' } else { 'OK' }
  Write-Output ("{0,-6} {1}  [{2}]" -f $flag, $r, ($a.actions -join ' | '))
  ($issues + $blocked) | Select-Object -First 10 | ForEach-Object { Write-Output "         - $_" }
}
Write-Output ("SUMMARY: {0} pages exercised, {1} with issues" -f $total, $withIssues)
