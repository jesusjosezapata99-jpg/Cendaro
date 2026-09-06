# Plan Maestro v2 — Partes 9 a 14: Cierre Global de Identidad Premium, Flujos Operativos e Interconexión Cendaro ERP

> **Status**: 📋 Awaiting User Approval (Master Roadmap)  
> **Date**: 2026-09-06  
> **Scope**: Todas las rutas restantes de `apps/erp/src/app/(app)/` (`containers`, `customers`, `vendors`, `invoices`, `delivery-notes`, `marketplace`, `whatsapp`, `audit`, `alerts`, `users`, `settings`, `pos`)  
> **Objetivo**: Diseñar y ejecutar la hoja de ruta definitiva y exhaustiva para elevar **todos los módulos restantes** de Cendaro ERP al estándar **Cendaro Premium (10/10)**, garantizando que cada pantalla, diálogo, tabla y flujo comercial opere con tipografía Geist, cifras en `font-mono tabular-nums`, tokens semánticos oficiales, elevación multi-capa `.surface-card`, cero emojis, 100% iconos dentro del subset de 136 glifos, y conexión total con la capa de procedimientos tRPC de backend sin modificar `packages/api/**` ni `packages/db/**`.

---

## Estructura de Fases

| Fase         | Módulos                                                      | Foco Principal                                                                                                                         |
| :----------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Parte 9**  | `/containers`, `/containers/[id]`                            | ✅ **Completado & Verificado (10/10)** — Importaciones, costeo FOB/CIF dual BCV, packing list IA sin emojis, workflow de transiciones. |
| **Parte 10** | `/customers`, `/customers/[id]`, `/vendors`, `/vendors/[id]` | Directorio de clientes con exposición crediticia, portal de comisiones a vendedores y liquidaciones.                                   |
| **Parte 11** | `/invoices`, `/delivery-notes`                               | Activación reactiva de stubs estáticos conectando órdenes de venta con emisión de comprobantes y despacho.                             |
| **Parte 12** | `/marketplace`, `/whatsapp`                                  | Mercado Libre B2B y CRM de ventas asistidas vía WhatsApp sin emojis, con deep-links interactivos.                                      |
| **Parte 13** | `/audit`, `/alerts`, `/users`, `/settings`                   | Gobernanza, log de auditoría inmutable, centro de alertas operativas, gestión de roles y configuración de workspace.                   |
| **Parte 14** | `/pos`, Auditoría Total Monorepo                             | Terminal de punto de venta rápido para mostrador (POS), escaneo de código de barras, multi-pago y auditoría de paridad global.         |

---

## Compuertas de Calidad por Fase

1. **TypeScript Estricto**: `pnpm --filter @cendaro/erp exec tsc --noEmit` & `pnpm typecheck` (6/6 paquetes exit code 0).
2. **ESLint Flat Config**: `pnpm --filter @cendaro/erp lint` (0 errores, 0 advertencias).
3. **Subset de Iconos**: 100% auditado contra `material-symbols-subset.txt`.
4. **Cero Emojis**: Ningún emoji en código de producción.
5. **Inviolabilidad de Backend**: 0 modificaciones a `packages/api/**` o `packages/db/**`.
6. **Evidencia Visual**: Capturas en 1440x900 en temas claro y oscuro para cada módulo.
7. **Living Memory & Graphify**: Prepend de sesión en `.gemini/knowledge/state.md` y ejecución de `graphify update .`.
