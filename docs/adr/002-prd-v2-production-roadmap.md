# ADR-002: Adopción del PRD v2.0 como hoja de ruta de producción

## Estado

**Aceptado** — 2026-09-12 (adopción del documento).
Las desviaciones de calendario que propone el plan de ejecución (decisiones D-10 y D-13) quedan **pendientes de aprobación** del dueño del producto.

## Contexto

- El [ADR-001](001-erp-v1-source-of-truth.md) adoptó el paquete ERP v1.0 como fuente de verdad funcional. Sobre esa base se construyó el esqueleto del sistema: 19 routers tRPC, 35 páginas y un schema Drizzle de unas 2.700 líneas.
- El dueño del producto confirmó que la mayoría de los módulos marcados como "✅ completos" en el README son **estructurales**: existen tabla, endpoint y pantalla, pero el flujo no se puede completar de punta a punta con garantías.
- El 2026-09-12 se ejecutó una auditoría de código línea por línea que **confirma y amplía** ese diagnóstico con evidencia (`archivo:línea`). Ver `.opencode/reports/AUDIT-REPORT-2026-09-PRD-V2-PRODUCTION-READINESS.md`.
- El PRD v2.0 ("Cendaro Rumbo a Producción y Mercado") define seis frentes: cierre de brechas, notas de crédito, facturación fiscal integrada, multiempresa/multi-sucursal, rediseño RAG del pipeline de IA, y seguridad/auditoría profesional.

## Decisión

1. El **PRD v2.0** pasa a ser la fuente de verdad del **alcance, la prioridad y los criterios de aceptación** de la etapa de producción (Fases 1a, 1b y 2).
2. El **PRD v1.0** sigue siendo la fuente de verdad de las **reglas de negocio cerradas** que el v2.0 no modifica.
3. El v2.0 **reemplaza explícitamente** estas reglas del v1.0:
   | Tema                 | PRD v1.0                                    | PRD v2.0                                                           |
   | -------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
   | Notas de crédito     | Fuera de alcance (§16.2, §23.1 "no aplica") | En alcance; aprobación exclusiva de `admin` (§6.3)                 |
   | Factura fiscal       | "Se maneja fuera del sistema" (§16.2)       | Integración con proveedores homologados (§7)                       |
   | Backups              | "Deseables, no bloqueantes" (§20.5)         | Obligatorios con prueba de restauración (§10.2)                    |
   | Clasificación fiscal | No existe                                   | `tax_classification` por producto con herencia de categoría (§7.5) |
   | Sucursales           | No existe                                   | Modelo `legal_entity` / `branch` (fundamento en Fase 1b, §8)       |
4. Los **hechos verificados** por la auditoría prevalecen sobre los supuestos del PRD v2.0. En particular: MFA/TOTP no está implementado, Sentry no está instalado, la RLS solo protege las escrituras, y la referencia a "tiempo real (Providencia 141)" debe validarla un asesor tributario. El PRD conserva su texto original y lleva al inicio una sección de erratas verificadas.

### Orden de prioridad ante conflictos (actualiza el de ADR-001)

1. Normativa tributaria vigente, **validada por un asesor tributario** (aplica a la sección 7 del PRD v2.0)
2. PRD v2.0 — alcance, prioridad y criterios de aceptación de la etapa de producción
3. PRD v1.0 — reglas de negocio cerradas no modificadas por el v2.0
4. ERD & Schema Blueprint v1
5. DBML Schema v1
6. Module/API Blueprint v1
7. Estructura y tooling existente del repositorio
8. PRD v0.7 (solo referencia histórica)

### Artefactos

| Artefacto                                     | Ubicación                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| PRD v2.0 (texto íntegro + control documental) | `docs/product/PRD_v2.0_Produccion_y_Mercado.md`                         |
| Auditoría de preparación para producción      | `.opencode/reports/AUDIT-REPORT-2026-09-PRD-V2-PRODUCTION-READINESS.md` |
| Plan de ejecución por fases                   | `.opencode/plans/PLAN-2026-09-PRD-V2-PRODUCTION-ROADMAP.md`             |

## Consecuencias

### Positivas

- Existe un único criterio de "terminado" (el checklist de 8 puntos del §4 del PRD v2.0), traducido a compuertas verificables en el plan.
- Se deja de medir el avance por pantallas construidas y se pasa a medirlo por flujos que cierran de punta a punta con pruebas.
- Las decisiones de diseño de esta etapa (sucursales, proveedor fiscal como plugin por workspace, API-first) mantienen abierta la puerta al SaaS y a la app móvil.

### Riesgos

- **Capacidad.** La Fase 1a, tal como está redactada, supera la capacidad de un solo desarrollador hasta diciembre de 2026. El plan propone una línea de corte explícita (decisión D-10).
- **Dependencia externa.** El frente fiscal depende de un asesor tributario y de la contratación de un proveedor homologado; su calendario no está bajo control del equipo.
- **Documentación desalineada.** El README describe controles que no existen (MFA, Sentry, auditoría inmutable). Hasta que se corrija, puede inducir a error a terceros (clientes, auditores).
