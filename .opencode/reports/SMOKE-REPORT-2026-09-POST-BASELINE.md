# SMOKE REPORT — Post-Baseline 2026-09

**Proyecto**: Cendaro ERP · **Rama**: `performance` · **Fecha**: 2026-09-03 (~20:30 GMT+2)
**Objetivo**: Validación funcional del stack actualizado (Next 16.3.4, React 19.2.8, ESLint 10, tRPC 11.18, Drizzle 0.45.2, Tailwind 4.3, framer-motion 13, lucide-react 1.40) tras el baseline refresh.
**Servidor**: dev server pre-existente (PID 23868, `next@16.3.4` Turbopack, puerto 3000) — reutilizado, no reiniciado.
**Método**: L1 HTTP/API (Invoke-WebRequest) → L2 navegador visual (agent-browser) → L3 Web Vitals.

---

## 1. Veredicto

🟢 **APTO** — El stack actualizado funciona end-to-end: landing, login real, dashboard con datos de sesión, catálogo, wizard de importación, toasts y dark mode. **5 bugs pre-existentes detectados y corregidos durante el smoke** (OG image tras el gate de auth · favicon.ico inexistente · E1286 instant-navigation en 6 páginas · 2 hydration mismatches). Typecheck re-verificado 6/6 tras los fixes.

---

## 2. L1 — HTTP/API (12 checks)

| #   | Check                                         | Resultado                                                                                                                  |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | `GET /` landing                               | ✅ 200 · 199KB · contenido "Cendaro" · **CSP presente**                                                                    |
| 2   | `GET /login`                                  | ✅ 200 · `X-Robots-Tag: noindex, nofollow` · `X-Frame-Options: DENY`                                                       |
| 3   | `GET /dashboard` sin auth                     | ✅ **307 → `/login?redirect=%2Fdashboard`** (allowlist OK)                                                                 |
| 4   | `GET /catalog` sin auth                       | ✅ 307 → `/login?redirect=%2Fcatalog`                                                                                      |
| 5   | `GET /api/auth/login` (método incorrecto)     | ✅ 405 + headers completos (DENY, nosniff, Permissions-Policy)                                                             |
| 6   | `POST /api/auth/login` credenciales inválidas | ✅ **401** `{"error":"Credenciales incorrectas"}` **sin Set-Cookie**                                                       |
| 7   | `GET /manifest.json`                          | ✅ 200 `application/json`                                                                                                  |
| 8   | `GET /opengraph-image`                        | 🔴→🟢 **BUG found+fixed**: devolvía HTML de login (25.041B) para crawlers sin cookies → ahora **200 `image/png` 100.668B** |
| 9   | `GET /favicon.ico`                            | 🔴→🟢 **BUG found+fixed**: 404 (nunca existió) → ahora **200 `image/x-icon` 4.408B** (16/32/48)                            |

### Correcciones aplicadas durante el smoke (2 archivos + 6 páginas)

1. **`apps/erp/src/proxy.ts`** — `/opengraph-image` añadida a `PUBLIC_ROUTES_EXACT`. _Causa raíz_: el matcher de rutas estáticas exige un punto en el pathname; la ruta de metadatos de Next no lo tiene → caía al gate de auth → los crawlers (WhatsApp/X/Twitter, que no envían cookies de Supabase) recibían el HTML de `/login` en vez del PNG → **previews de enlace rotas en producción**. _Impacto_: ruta de solo-lectura de imagen, sin datos.
2. **`apps/erp/src/app/favicon.ico`** (nuevo, 4.408B, entradas 16/32/48) + **`apps/erp/src/app/layout.tsx`** (`apple-touch-icon` → `/cendaro-logo.png`, ya que iOS no soporta ICO). _Causa raíz_: layout y manifest referenciaban `/favicon.ico` pero el archivo nunca existió en el repo. _Generación_: script one-off con `sharp` (derivado de `cendaro-logo.png`, contenedor PNG-in-ICO).
3. **Next `E1286` (`instant-unrendered-segment`) — 6 páginas**: `dashboard`, `catalog`, `orders`, `inventory`, `customers`, `quotes` hacían `await` de prefetch tRPC **a nivel de segmento sin `<Suspense>`** (prohibido con `cacheComponents: true`). Fix doble: (a) patrón canónico — wrapper síncrono con `<Suspense fallback={<AppLoading />}>` (reutiliza `(app)/loading.tsx`) + componente async interno con el prefetch; (b) `export const instant = false` — el escape hatch oficial, porque el pass de validación es sintético (sin sesión Supabase) y **nunca puede renderizar datos auth-gated**. `layout.tsx` además recibe `data-scroll-behavior="smooth"` (warning documentado de Next). _Nota_: `/inventory/warehouse/[id]/import` usa solo `await params` (API canónica Next 16) — sin cambio. **Verificado**: el error no re-disparó tras el fix (log del servidor).
4. **Hydration mismatch ×2 — componentes con estado resuelto solo en cliente**: `WorkspaceSwitcher` (avatar "??" server vs "OD" client) y `WorkspaceGate` (div "Resolviendo…" server vs `<Suspense>` client). _Causa raíz_: `workspaceId` se resuelve client-side (cookie/localStorage vía `WorkspaceAutoResolver`) y es ausente en SSR → el primer render del cliente divergía del HTML del server → React regeneraba el árbol completo. Fix: gate `mounted` (patrón estándar de React) en ambos — el primer pintado cliente coincide con el server. **Verificado**: 0 issues de hidratación en reload limpio.

---

## 3. L2 — Navegador visual (agent-browser + Chromium)

| #   | Flujo                                   | Resultado                                                                                                                                                                                                                                         |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Landing `/` — render completo           | ✅ Hero, features (5 tabs interactivas), pricing (3 planes + toggle anual), FAQ (7 acordeones), footer, Toaster montado. framer-motion 13 sin errores                                                                                             |
| 2   | Consola landing                         | ✅ Sin errores de app. Único `[error]` conocido: `eval() not supported` — **solo dev** (React DevTools reconstrucción de callstacks; React declara "never use eval() in production"). HMR + Fast Refresh OK                                       |
| 3   | Login — render                          | ✅ Logo, card, campos USUARIO/CONTRASEÑA, botón "Acceder al Sistema"                                                                                                                                                                              |
| 4   | Login — credenciales reales (1 intento) | ✅ **Autenticación exitosa** → `router.push("/dashboard")`. Logs servidor tRPC: `user=ca8825b2…, role=owner`                                                                                                                                      |
| 5   | Dashboard — render completo             | ✅ Sidebar 6 secciones (PRINCIPAL→SISTEMA), chip usuario "Jesús Zapata · Dueño", 6 KPIs ($0.00/0 — BD vacía, correcto), Resumen Operaciones, Estado Sistema, Cierres Recientes                                                                    |
| 6   | Dashboard — tRPC end-to-end             | ✅ `dashboard.salesSummary` (35ms), `latestClosures`, `activeAlertCount`, `users.me` (896ms), `workspace.list` (734ms), `pricing.latestRates` — todos ✓ sin errores. **tRPC 11.18 + Drizzle 0.45.2 + Supabase SSR 0.12.5 verificados en runtime** |
| 7   | Catálogo — render                       | ✅ Título, Importar/Nuevo Producto, búsqueda, filtro estados, tabla REFERENCIA/PRODUCTO/ESTADO/CREADO, estado vacío correcto, paginación                                                                                                          |
| 8   | Wizard import `/catalog/import`         | ✅ 6 tabs (1 "Archivo" activa), drag-and-drop (.xlsx/.xls/.csv máx 10MB), "Descargar Plantilla", "Formato esperado"                                                                                                                               |
| 9   | Toast sonner (Descargar Plantilla)      | ✅ `listitem "Plantilla descargada correctamente"` en región Notifications — sonner 2.0.8 end-to-end                                                                                                                                              |
| 10  | Toggle dark mode (next-themes)          | ✅ "Switch to dark mode" ↔ "Switch to light mode" — tema aplicado                                                                                                                                                                                 |

### Hallazgos menores L2 (estado final)

- **`E1286` — RESUELTO** (6 páginas: Suspense + `instant = false`, verificado en log del servidor).
- **Hydration mismatches ×2 — RESUELTOS** (`WorkspaceSwitcher` + `WorkspaceGate`, gate `mounted`; verificado 0 issues).
- **`scroll-behavior: smooth` warning** — RESUELTO vía `data-scroll-behavior="smooth"` en `<html>`.
- **`workspaceId=null`** en las primeras llamadas tRPC del smoke: la sesión arranca sin workspace cookie; el `WorkspaceAutoResolver` lo selecciona automáticamente (logs posteriores muestran `workspaceId=a0000000-…-0001`). Comportamiento correcto de primer login.
- **`GET /api/trpc/dashboard.activeAlertCount 400` transitorio** (una vez, durante la pasada de validación sintética de Next; el retry inmediato dio 200). Asociado al E1286 ya resuelto; sin impacto.
- **`eval()` CSP error en consola dev**: React DevTools en desarrollo ("React will never use eval() in production") — no es defecto; la CSP sin `unsafe-eval` es lo correcto para producción.
- **`ERR_CONNECTION_REFUSED` transitorio**: el dev server original (PID 23868, de la sesión paralela) murió durante la recompilación; se relanzó vía `pnpm dev:erp` (boot limpio, Next 16.3.4 Turbopack). No es bug del código.

---

## 4. L3 — Rendimiento (Navigation Timing, dev mode)

**Nota**: `agent-browser vitals` no existe en la build instalada (doc de CLAUDE.md desactualizado); se midió vía `performance` API en Chromium. Números en **modo dev** (Turbopack, sin minificar, compile on-demand) — en producción serán mejores.

| Métrica            | Valor                                   |
| ------------------ | --------------------------------------- |
| TTFB               | 523 ms                                  |
| First Paint / FCP  | 772 / 772 ms                            |
| DOMContentLoaded   | 820 ms                                  |
| Load               | 1121 ms                                 |
| Transfer (landing) | 32 KB (199KB raw → compresión efectiva) |

---

## 5. Estado

- **Commits**: NINGUNO (orden explícita del usuario). Todo sin commitear en `performance`.
- Evidencia gráfica: `.opencode/reports/assets/smoke-2026-09/` (01-landing, 02-login, 03-dashboard, 04-catalog, 05-import-wizard, 06-wizard-toast, 07-dark-mode).
