# Plan v2 — Parte 8: Tasas de Cambio & Motor de Precios (`/rates` y `/pricing`)

> **Status**: ✅ Completed & Verified (10/10 Quality)  
> **Date**: 2026-09-06  
> **Goal**: Elevar la suite financiera y operativa de divisas y precios (**`/rates`** y **`/pricing`**) al estándar **Cendaro Premium**: unificar la tipografía con Geist y `font-mono tabular-nums`, sustituir todos los emojis prohibidos (`🏛️`, `💱`, `🔄`, `▲`, `▼`) por glifos oficiales del subset de 136 caracteres (`account_balance`, `currency_exchange`, `currency_yuan`, `sync_alt`, `trending_up`, `trending_down`), dotar a las tarjetas de divisas de indicadores de delta y badges "En vivo", renovar la tarjeta de Brecha Cambiaria (Spread), rediseñar la Calculadora Multi-moneda con selector dinámico y botón de swap, y optimizar el Motor de Repricing con workflow de aprobación ejecutiva dentro de la ventana de 24 horas y vista dual móvil/desktop.

---

## 1. Baseline Audit & Technical State

### 1.1 Current Files & Issues

- **`apps/erp/src/app/(app)/rates/client.tsx`**:
  - Utiliza emojis prohibidos en la definición de metadatos de tasas (`🏛️` para BCV, `💱` para Paralelo, `🔄` para fallback).
  - Utiliza caracteres unicode directos (`▲` / `▼`) en lugar de iconos vectoriales semánticos del subset (`trending_up`, `trending_down`).
  - No emplea primitivas Cendaro Premium (`PageHeader`, `StatCard`, `StatusBadge`, `Button`, `EmptyState`, `.surface-card`).
  - La calculadora de conversión carece de botón de intercambio rápido (swap) y estilos avanzados de inputs.
  - La tabla de historial de tasas carece de vista móvil adaptada con touch targets adecuados.
- **`apps/erp/src/app/(app)/pricing/client.tsx`**:
  - Estilos ad-hoc con bordes simples y tabs básicos.
  - No utiliza `PageHeader`, `StatCard`, `StatusBadge` ni `EmptyState`.
  - El botón de aprobación no cuenta con protección explícita mediante `RoleGuard`.
  - Falta vista dual móvil para los eventos de repricing y la tabla de auditoría de precios.
- **Backend Availability (`packages/api/src/modules/pricing.ts`)**:
  - Procedimientos existentes: `pricing.latestRates`, `pricing.rateHistory`, `pricing.setRate` (solo fuentes autorizadas: `dolarapi-`, `frankfurter`, `system-sync`), `pricing.convert`, `pricing.priceHistory`, `pricing.listRepricingEvents`, `pricing.approveRepricing`.

---

## 2. Surgical Implementation Steps

### Step 1: Módulo de Tasas de Cambio (`apps/erp/src/app/(app)/rates/client.tsx`)

1. **Header Semántico**:
   - Integrar `PageHeader` con título "Tasas de Cambio", descripción ejecutiva y botón "Actualizar Tasas" (`RoleGuard` para roles autorizados) que dispara la comprobación activa de fuentes externas.
2. **Iconos del Subset Oficial**:
   - Reemplazar emojis:
     - `bcv` -> `account_balance`
     - `parallel` -> `currency_exchange`
     - `rmb_usd` -> `currency_yuan`
     - `rmb_bs` -> `sync_alt`
     - Tendencias -> `trending_up` (alza) y `trending_down` (baja).
3. **4 Tarjetas Principales de Divisas**:
   - Contenedores `.surface-card border-border-subtle rounded-xl`.
   - Valor numérico en `font-mono text-3xl font-bold tabular-nums`.
   - Badge "En vivo" cuando proviene de DolarAPI / Frankfurter.
   - Indicador de delta porcentual respecto al registro anterior con color semántico e icono de tendencia.
   - Fecha y fuente oficial de la cotización.
4. **Tarjeta de Brecha Cambiaria (Spread)**:
   - Resumen visual de la diferencia entre BCV y Paralelo USDT.
   - Tono semántico condicional: neutral (<5%), warning (5-15%), destructive (>15%).
   - Indicador del diferencial neto en Bolívares por dólar.
5. **Calculadora de Conversión Multi-Moneda**:
   - Input de monto numérico con `font-mono tabular-nums`.
   - Selectores De/A para USD, Bs y RMB con botón interactivo de inversión de sentido (`swap_horiz`).
   - Selector de tasa base (Oficial BCV vs Paralelo USDT) cuando interviene Bs.
   - Display de resultado con alto contraste, tipografía Geist Mono y etiqueta explicativa de la tasa empleada.
6. **Historial de Tasas**:
   - Filtro por tipo de divisa mediante chips horizontales (`mobile-scroll-x`).
   - Vista dual responsiva: tarjetas táctiles móviles (`md:hidden`, touch targets $\ge 44\text{px}$) y tabla desktop (`hidden md:block`) con headers uppercase tracking amplio y cifras en `font-mono tabular-nums`.

### Step 2: Módulo de Motor de Precios (`apps/erp/src/app/(app)/pricing/client.tsx`)

1. **Header Semántico**:
   - Integrar `PageHeader` con título "Motor de Precios", descripción ejecutiva y badge de advertencia cuando existan eventos pendientes de aprobación.
2. **Alerta de Variación Crítica**:
   - Banner reactivo estilizado para variaciones $\ge 5\%$ con advertencia sobre la ventana de aprobación de 24 horas.
3. **4 StatCards Ejecutivas**:
   - Eventos de Repricing, Pendientes de Aprobación, Cambios de Precio e Historial de Productos Afectados.
4. **Tabs Semánticos**:
   - Selector estilizado entre "Eventos de Repricing" e "Historial de Precios".
5. **Workflow de Aprobación**:
   - Tarjetas de eventos con trigger badge (`bolt` para automático, `edit` para manual, `schedule` para programado).
   - Botón "Aprobar" protegido por `RoleGuard allow={["owner", "admin", "supervisor"]}` que ejecuta `pricing.approveRepricing` e invalida `[['pricing']]`.
   - Badge "Aprobado" (`StatusBadge` tone `success`) para eventos consolidados.
6. **Tabla de Historial de Precios**:
   - Auditoría de modificaciones de producto con precio anterior tachado, precio nuevo en `font-mono tabular-nums font-bold`, tasa aplicada y disparador.

---

## 3. Verification & Quality Gates

1. **TypeScript & ESLint**:
   - `pnpm --filter @cendaro/erp exec tsc --noEmit` -> Exit 0.
   - `pnpm typecheck` -> 6/6 paquetes exit 0.
   - `pnpm --filter @cendaro/erp lint` -> 0 errores, 0 warnings.
2. **Icon Subset Audit**:
   - 100% de los iconos verificados contra `material-symbols-subset.txt`.
   - Cero emojis en toda la interfaz.
3. **Cendaro Design Compliance**:
   - Tipografía Geist Sans / Geist Mono.
   - Todas las cifras y tasas en `font-mono tabular-nums`.
   - Touch targets móviles $\ge 44\text{px}$ (`min-h-11`).
4. **Visual Evidence**:
   - Capturas en 1440x900 para `/rates` y `/pricing` en temas light y dark.
5. **Living Memory & Graphify**:
   - Actualización de `.gemini/knowledge/state.md` con Session 103.
   - Ejecución de `graphify update .`.
