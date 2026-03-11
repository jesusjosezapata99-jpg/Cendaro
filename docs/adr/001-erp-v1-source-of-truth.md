# ADR-001: Adopción de ERP v1.0 como fuente de verdad

## Estado

**Aceptado** — 2026-03-11

## Contexto

El repositorio contenía un PRD v0.7 ("semi-hecho") como documento principal de producto con 10 preguntas abiertas (variantes, costeo, notas de crédito, aprobaciones, etc.) y recomendaciones de stack que no coinciden con la implementación real (sugería NestJS + Prisma vs el Next.js + Drizzle implementado).

Se recibió un paquete de especificación ERP v1.0 compuesto por 4 documentos cerrados para diseño:

1. **PRD v1.0** — especificación funcional completa (1283 líneas)
2. **ERD & Schema Blueprint v1** — modelo de datos relacional (468 líneas)
3. **DBML Schema v1** — esquema legible por máquina (515 líneas)
4. **Module/API Blueprint v1** — estructura de módulos y superficie API (325 líneas)

## Decisión

Adoptar los 4 documentos del paquete ERP v1.0 como la fuente arquitectónica de verdad canónica del proyecto, reemplazando al PRD v0.7.

### Orden de prioridad ante conflictos

1. PRD v1.0
2. ERD & Schema Blueprint v1
3. DBML Schema v1
4. Module/API Blueprint v1
5. Estructura y tooling existente del repositorio
6. PRD v0.7 (solo como referencia histórica)

### Acciones tomadas

- PRD v0.7 archivado como `docs/product/LEGACY_PRD_v0.7.md`
- PRD v0.7 raíz (`PRD.md`) marcado con banner de deprecación
- 4 documentos nuevos colocados en estructura profesional `/docs`
- Documentado mapeo de alineación entre schema.ts existente y nuevo ERD
- Creados placeholders de módulos en `apps/erp/src/modules/`

## Consecuencias

### Positivas

- El equipo tiene una fuente única y sin ambigüedades para tomar decisiones
- 10 preguntas abiertas del v0.7 quedan resueltas (modelo de variantes = SKU independiente, matriz de aprobaciones cerrada, notas de crédito excluidas de v1)
- Stack documentado coincide con stack implementado
- La estructura modular queda definida con 12 bounded contexts

### Riesgos

- El schema.ts existente (Drizzle, 30+ tablas) tiene divergencias de naming y tablas faltantes respecto al nuevo ERD. Se requiere un plan de migración incremental separado.
- Algunos campos del schema existente (como `priceType: "special"`) ya no existen en v1.0 y deberán deprecarse progresivamente.
