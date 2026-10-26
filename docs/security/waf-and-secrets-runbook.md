# Cendaro ERP — WAF, Perímetro y Runbook de Rotación de Secretos (F9.4)

## 1. Controles Perimetrales y WAF (`vercel.json` & `next.config.js`)

### 1.1 Cabeceras de Seguridad HTTP

Aplicadas en todas las rutas de `apps/erp` (`next.config.js` y `vercel.json`):

- `Content-Security-Policy`: `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `script-src` sin `'unsafe-eval'` en producción, y `https://challenges.cloudflare.com` habilitado para Cloudflare Turnstile.
- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload` (en producción).
- `X-Content-Type-Options`: `nosniff`.
- `X-Frame-Options`: `DENY`.
- `Cross-Origin-Opener-Policy`: `same-origin`.
- `Cross-Origin-Resource-Policy`: `same-origin`.

### 1.2 Límites de Payload y Rate Limiting por Endpoint

| Endpoint                          | Límite de Cuerpo | Rate Limit                                                     | Protección Adicional                                                    |
| --------------------------------- | ---------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `POST /api/auth/login`            | `4 KB`           | 5 req/60s por IP + 10 req/15m por usuario + Lockout escalonado | Cloudflare Turnstile CAPTCHA + Constant-time dummy auth                 |
| `POST /api/auth/create-user`      | `16 KB`          | 3 req/60s por IP                                               | Verificación CSRF Origin + Rol desde DB (`workspace_member`)            |
| `POST /api/trpc/*`                | `1 MB`           | Por procedimiento (`rateLimit`)                                | `wsPermissionProcedure` / `wsReadPermissionProcedure` + RLS `SET LOCAL` |
| `POST /api/ai/parse-packing-list` | `10 MB`          | 5 req/60s por usuario                                          | Validación MIME + Auth obligatoria                                      |
| `GET /api/cron/sync-rates`        | N/A              | Bearer `CRON_SECRET` (≥ 32 chars)                              | Comparación en tiempo constante (`timingSafeEqual`)                     |

---

## 2. Activación de MFA Obligatorio (`MFA_ENFORCEMENT_DATE`)

1. **Pre-requisito**: Todos los usuarios con rol `owner` o `admin` ven el banner persistente (`MfaBanner`) en el `AppShell` con enlace directo a `/settings/security`.
2. **Programación de Cutover**:
   - Configurar en Vercel Environment Variables (Production):
     ```env
     MFA_ENFORCEMENT_DATE=2026-11-15
     ```
   - Durante los días previos a la fecha UTC configurada, el banner muestra la cuenta regresiva en días.
   - A partir de las `00:00:00Z` de `MFA_ENFORCEMENT_DATE`, cualquier sesión `owner` o `admin` con nivel `aal1` (sin segundo factor TOTP verificado en el login) recibe `FORBIDDEN` en todas las mutaciones de `workspaceProcedure`.

---

## 3. Procedimiento de Rotación de Secretos

### 3.1 `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL`

1. Ingresar a **Supabase Dashboard** (`ljwoptpaxazqmnhdczsb`) → **Settings → API / Database**.
2. Generar nueva contraseña de base de datos / rotar `service_role` key.
3. Actualizar inmediatamente `DATABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en **Vercel → Project Settings → Environment Variables**.
4. Ejecutar redeploy sin caché de producción en Vercel.

### 3.2 `CRON_SECRET`

1. Generar nuevo secreto de 256 bits:
   ```bash
   openssl rand -hex 32
   ```
2. Actualizar `CRON_SECRET` en Vercel y redesplegar.

### 3.3 `TURNSTILE_SECRET_KEY` y `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

1. En **Cloudflare Dashboard → Turnstile**, rotar el Secret Key del widget de producción.
2. Actualizar `TURNSTILE_SECRET_KEY` en Vercel y redesplegar.
