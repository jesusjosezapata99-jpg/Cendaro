Lanzar múltiples agentes en los cuales cada uno se encargue de estas tareas, se compartan las tareas y creen un plan a nivel profesional proponiendo posibles cambios. Auditar de forma crítica la seguridad, escalabilidad, funcionalidad e interconexión de todos los módulos y apartados para empleados, así como el rendimiento en local y en la nube en Venezuela (latencia hacia bases de datos y fluidez con animaciones) del sistema ERP Cendaro, elaborando un plan profesional con propuestas de cambio fundamentadas sin modificar código en esta fase.

Integrity mode: development

## Requirements

### R1. Auditoría de Seguridad y Escalabilidad

Auditar la arquitectura y el código del proyecto identificando vulnerabilidades de seguridad, cumplimiento de buenas prácticas de autenticación/autorización y cuellos de botella para la escalabilidad. Entregar un informe crítico que documente los riesgos detectados y su nivel de severidad.

### R2. Auditoría Funcional, Interconexión y Ergonomía de Módulos

Revisar integralmente todos los módulos y apartados destinados a empleados, verificando su estado funcional actual, su correcta interconexión y la rapidez de acceso ergonómica y visual. Documentar detalladamente los elementos y flujos pendientes por cerrar para alcanzar el 100% de operatividad.

### R3. Auditoría de Rendimiento y Latencia (Local, Nube y Venezuela)

Evaluar el rendimiento del ERP para su operación fluida tanto en local como en la nube con acceso desde Venezuela, auditando la latencia en la conexión y consultas a la base de datos, así como la fluidez de las animaciones existentes frente a condiciones de red adversas.

### R4. Plan Profesional de Propuestas de Cambio

Consolidar los hallazgos en un plan estratégico estructurado que proponga soluciones y mejoras justificadas con criterio crítico, sin modificar archivos de código en esta fase del encargo.

## Verification Resources

- Comprobaciones existentes del repositorio: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `node scripts/checks/design-guard.mjs --phase F9`.
- Rúbrica de auditoría técnica que desglose punto por punto: riesgos de seguridad, límites de escalabilidad, operatividad de módulos, métricas de rendimiento/latencia y catálogo de cambios propuestos.

## Acceptance Criteria

### Informes de Auditoría

- [ ] El informe de seguridad y escalabilidad documenta vulnerabilidades encontradas, riesgos y cuellos de botella con nivel de severidad.
- [ ] El inventario de módulos y apartados de empleados detalla para cada uno su estado funcional actual, brechas de interconexión, aspectos visuales/de acceso y tareas pendientes para el 100%.
- [ ] El análisis de rendimiento evalúa la latencia hacia los servidores de base de datos, el impacto en despliegues nube para Venezuela y la fluidez de las animaciones.

### Plan Profesional

- [ ] El plan estratégico consolida las propuestas de cambio priorizadas con su justificación técnica sin realizar modificaciones al código del repositorio.
- [ ] Las herramientas de comprobación del repositorio (`pnpm typecheck`, `pnpm lint`, `pnpm test`) se ejecutan y sus resultados se incorporan al diagnóstico.
