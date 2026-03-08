<p align="center">
  <img src="https://img.shields.io/badge/Cendaro-ERP-2463eb?style=for-the-badge&logoColor=white" alt="Cendaro" />
  <img src="https://img.shields.io/badge/Next.js-16-000?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
</p>

# 🏗️ Cendaro

> **Sistema ERP omnicanal de grado empresarial** para comercio mayorista + detallista en Venezuela.
> Gestión unificada de inventarios, ventas, precios, canales y finanzas con motor de repricing multimoneda.

---

## 📐 Arquitectura

```
cendaro/
├── apps/
│   └── erp/                         ← Next.js 16 App Router (PWA)
├── packages/
│   ├── @cendaro/db                 ← Drizzle ORM + PostgreSQL schema
│   ├── @cendaro/api                ← tRPC v11 + RBAC procedures
│   ├── @cendaro/auth               ← Supabase SSR (server/client/middleware)
│   ├── @cendaro/ui                 ← shadcn/ui + Cendaro design system
│   └── @cendaro/validators         ← Zod v4 shared domain schemas
├── tooling/
│   ├── eslint/                      ← ESLint 9 flat config
│   ├── prettier/                    ← Import sorting + Tailwind plugin
│   ├── typescript/                  ← Strict ES2024 base config
│   └── tailwind/                    ← Cendaro theme (oklch blue #2463eb)
├── pnpm-workspace.yaml              ← Workspace + dependency catalog
├── turbo.json                       ← Turborepo pipeline
└── package.json                     ← Root scripts
```

---

## 🔧 Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Runtime** | Node.js | ≥ 20 (LTS) |
| **Package Manager** | pnpm | 10.30.3 |
| **Build Orchestration** | Turborepo | 2.8.14 |
| **Framework** | Next.js (App Router) | 16.x |
| **UI Library** | React | 19.1.4 (stable) |
| **Language** | TypeScript (strict) | 5.9.3 |
| **CSS** | Tailwind CSS v4 | 4.2.1 |
| **Components** | shadcn/ui + Radix | new-york style |
| **API Layer** | tRPC v11 | 11.12.0 |
| **ORM** | Drizzle | 0.45.1 |
| **Database** | Supabase PostgreSQL | Managed |
| **Auth** | Supabase Auth SSR | 0.6.x |
| **Validation** | Zod v4 | 4.3.6 |
| **Server State** | TanStack Query | 5.90.x |
| **Background Jobs** | pg-boss (planned) | — |

> **Política de versiones:** Se usa la versión estable más reciente verificada, no la más nueva. Todas las versiones están centralizadas en `pnpm-workspace.yaml` → sección `catalog:`.

---

## 🚀 Quick Start

```bash
# 1. Clonar e instalar
git clone <repo-url> cendaro
cd cendaro
pnpm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con credenciales de Supabase

# 3. Desarrollo
pnpm dev              # Inicia todos los packages en watch mode
pnpm dev:erp          # Solo la app ERP

# 4. Verificación
pnpm build            # Build de producción
pnpm typecheck        # Verificación de tipos
pnpm lint             # Linting ESLint
```

---

## 📦 Paquetes del Workspace

### `@cendaro/db` — Base de Datos
- Drizzle ORM con conexión lazy-init (singleton)
- Schema inicial: `audit_log` (append-only), `organization`
- Enum `user_role`: admin, owner, supervisor, cashier, vendor, viewer
- Migraciones via `drizzle-kit`

### `@cendaro/api` — Capa de Negocio
- tRPC v11 con contexto (User + DB)
- Procedures: `publicProcedure`, `protectedProcedure`, `roleRestrictedProcedure()`
- Router modular por dominio (`modules/`)
- Transformador Superjson + errores Zod formateados

### `@cendaro/auth` — Autenticación
- Supabase SSR: server client, browser client, middleware client
- Preparado para Next.js App Router con cookies

### `@cendaro/ui` — Componentes
- shadcn/ui (new-york) con Radix primitives
- Component: `Button` (7 variants incl. success/warning, 4 sizes incl. xl)
- Utility: `cn()` (tailwind-merge + clsx)
- Theme: Cendaro blue (#2463eb) en oklch

### `@cendaro/validators` — Validación
- Schemas compartidos Zod v4 para frontend + backend
- Primitivas venezolanas: RIF, cédula, bolívares
- Primitivas ERP: dinero, tasa de cambio, porcentaje, SKU, código de barras
- Mensajes de error en español

---

## 🖥️ Páginas del ERP

| Ruta | Módulo | Estado |
|------|--------|--------|
| `/dashboard` | Dashboard Ejecutivo | ✅ UI completa |
| `/catalog` | Catálogo de Productos | ✅ UI completa |
| `/inventory` | Control de Inventario | ✅ UI completa |
| `/pos` | Punto de Venta | ✅ UI completa |
| `/rates` | Tasas de Cambio | ✅ UI completa |
| `/containers` | Contenedores | 🔲 Stub (Fase 2) |
| `/pricing` | Gestión de Precios | 🔲 Stub (Fase 3) |
| `/orders` | Pedidos | 🔲 Stub (Fase 4) |
| `/vendors` | Portal Vendedores | 🔲 Stub (Fase 6) |
| `/customers` | Clientes | 🔲 Stub (Fase 4) |
| `/marketplace` | Mercado Libre | 🔲 Stub (Fase 5) |
| `/whatsapp` | WhatsApp Ventas | 🔲 Stub (Fase 5) |
| `/payments` | Pagos | 🔲 Stub (Fase 4) |
| `/cash-closure` | Cierre de Caja | 🔲 Stub (Fase 4) |
| `/users` | Gestión de Usuarios | 🔲 Stub (Fase 1) |
| `/audit` | Log de Auditoría | 🔲 Stub (Fase 1) |
| `/settings` | Configuración | 🔲 Stub (Fase 1) |

---

## 🎨 Design System (Cendaro Theme)

```
Primary:     #2463eb (oklch blue)
Success:     oklch(0.70 0.15 145)
Warning:     oklch(0.75 0.15 75)
Destructive: oklch(0.55 0.2 25)
Shadows:     5-level enterprise scale (xs → 2xl)
Dark mode:   Class-based (.dark)
Font:        Inter (Google Fonts)
```

Definido en `tooling/tailwind/theme.css` — importado globalmente via `@import "@cendaro/tailwind-config/theme"`.

---

## 🗺️ Roadmap por Fases

| Fase | Alcance | Estado |
|------|---------|--------|
| **0** | Foundation — monorepo, tooling, theme | ✅ Completada |
| **1** | Schema + RBAC + Audit | 🔲 Pendiente |
| **2** | Catálogo + Inventario + Recepción | 🔲 Pendiente |
| **3** | Precios + Tasas de Cambio | 🔲 Pendiente |
| **4** | Ventas + Pagos + Cierre de Caja | 🔲 Pendiente |
| **5** | Mercado Libre + WhatsApp | 🔲 Pendiente |
| **6** | Dashboards + Portal Vendedores | 🔲 Pendiente |
| **7** | Tests + Hardening + CI/CD | 🔲 Pendiente |

---

## 🔐 Modelo de Seguridad

- **Autenticación**: Supabase Auth (email/password)
- **Autorización**: RBAC via tRPC middleware (`roleRestrictedProcedure()`)
- **Aislamiento de datos**: Supabase RLS policies (vendor data isolation)
- **Audit trail**: Tablas append-only (`audit_log`, `stock_ledger`, `price_history`)
- **Storage**: Policies por rol para evidencia de pagos
- **Backend**: Service-role key para operaciones privilegiadas

---

## 📝 Variables de Entorno

```bash
# Supabase (requerido)
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Observabilidad (opcional en dev)
SENTRY_DSN=https://...

# Mercado Libre (Fase 5)
MERCADOLIBRE_APP_ID=
MERCADOLIBRE_SECRET=
MERCADOLIBRE_REDIRECT_URI=

# Aplicación
PORT=3000
```

---

## 🔄 Políticas de Documentación

Este proyecto mantiene sincronización automática entre:
- **README.md** — Referencia técnica del proyecto (este archivo)
- **PRD** — Documento de requisitos del producto
- **implementation_plan.md** — Plan de implementación detallado

> **Regla**: Todo cambio crítico (nuevo módulo, cambio de schema, nueva dependencia, cambio de arquitectura) debe verificarse contra el PRD y reflejarse en el README.

Ver `.agents/workflows/prd-sync.md` para el flujo de sincronización.

---

## 📜 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Desarrollo — watch mode en todos los packages |
| `pnpm dev:erp` | Solo la app ERP |
| `pnpm build` | Build de producción |
| `pnpm typecheck` | Verificación de tipos TypeScript |
| `pnpm lint` | Linting con ESLint |
| `pnpm format` | Verificar formateo Prettier |
| `pnpm format:fix` | Auto-formatear |
| `pnpm db:push` | Push schema a Supabase |
| `pnpm db:studio` | Abrir Drizzle Studio |
| `pnpm db:generate` | Generar migración |
| `pnpm ui-add` | Agregar componente shadcn/ui |

---

<p align="center">
  <sub>Cendaro © 2026 — Built with ❤️ for Venezuelan commerce</sub>
</p>
