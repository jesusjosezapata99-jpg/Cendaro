# Original User Request

## Initial Request — 2026-10-31T18:57:13Z

Ejecuta la cantidad necesaria de agentes que puedas para esta tarea. Ejecutar una auditoría profesional y avanzada de ciberseguridad e investigación profunda sobre posibles brechas de seguridad en todos los módulos del sistema ERP Cendaro (desde la landing page hasta cualquier módulo), identificando vectores de ataque de robo de datos, manipulación de precios y accesos indebidos, y entregando un informe exhaustivo con el plan detallado de remediación sin modificar código en esta fase.

Integrity mode: demo
The team must NOT: ejecutar scripts externos o delegar la ejecución a herramientas o servicios externos

## Requirements

### R1. Auditoría Integral de Ciberseguridad y Deep Research

Ejecutar un deep research y auditoría exhaustiva en todos los módulos del ERP Cendaro (landing page, aplicaciones web, endpoints tRPC, autenticación Supabase, políticas RLS y esquemas de base de datos). Identificar todos los vectores por los cuales un atacante podría robar datos, alterar precios, escalar privilegios o vulnerar el sistema.

### R2. Informe Exhaustivo y Plan de Remediación

Documentar detalladamente cada vulnerabilidad detectada indicando su ubicación exacta, vector de explotación, nivel de severidad e impacto potencial para el negocio. Estructurar un plan de remediación profesional con las recomendaciones técnicas necesarias para mitigar cada brecha, sin modificar archivos de código del repositorio en esta fase.

### R3. Entorno de Pruebas y Restricciones Operativas

Las evaluaciones dinámicas pueden realizarse contra entornos desplegados o de staging si están disponibles, manteniendo el análisis estático y arquitectónico como base principal. Se prohíbe terminantemente ejecutar escrituras, modificaciones o mutaciones destructivas sobre la base de datos de producción sin aprobación explícita, respetando las directivas del repositorio.

## Verification Resources

- Herramientas y comprobaciones del repositorio: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `procedure-authz-coverage.test.ts` y scripts de comprobación de permisos.
- Estándares de seguridad: Rúbrica de evaluación basada en OWASP Top 10, ASVS y la matriz de roles y permisos del ERP (`packages/validators`).

## Acceptance Criteria

### Informe de Auditoría y Brechas

- [ ] El informe cubre todos los módulos del ERP (desde la landing page hasta los módulos internos), detallando vectores de ataque para robo de datos, alteración de precios y bypass de autorización.
- [ ] Cada hallazgo incluye clasificación de severidad, evidencia técnica (archivo, endpoint o política afectada) y recomendación de mitigación.
- [ ] El código del repositorio permanece sin modificaciones en esta fase.

### Verificación y Conformidad

- [ ] La auditoría verifica la cobertura de autorización de procedimientos tRPC y la consistencia de políticas RLS contra la matriz de permisos.
- [ ] No se realizan escrituras ni mutaciones no autorizadas sobre bases de datos o servicios de producción.
