# Inventario de datos personales

Qué datos personales guarda Cendaro, para qué, cuánto tiempo y quién accede. Se actualiza cuando una tabla, un log o un proveedor externo empieza a manejar datos personales nuevos.

## Dónde están

| Datos                                                         | Ubicación                                                        | Para qué                                                    | Retención actual                                     | Quién accede                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| Correo y contraseña de acceso                                 | Supabase Auth                                                    | Iniciar sesión                                              | Hasta que un administrador elimina la cuenta         | Service role del servidor                                           |
| Nombre, correo, usuario, teléfono, avatar del equipo          | `user_profile`                                                   | Identificar al usuario                                      | Hasta `users.anonymizeMyData`                        | El propio usuario; roles con permiso sobre usuarios en su workspace |
| Nombre, RIF o cédula, teléfono, correo, dirección de clientes | `customer`, `customer_address`, `delivery_note.delivery_address` | Vender, entregar y cobrar                                   | Sin purga                                            | Roles con permiso sobre clientes; un vendedor solo los suyos        |
| RIF, nombre y dirección del comprador                         | `fiscal_document`                                                | Documento fiscal. Hoy apagado con `FISCAL_EMISSION_ENABLED` | Inmutable                                            | Roles con permiso fiscal                                            |
| RIF y contacto de proveedores                                 | `supplier`                                                       | Compras                                                     | Sin purga                                            | Roles con permiso sobre proveedores                                 |
| Apodo del comprador de Mercado Libre                          | `ml_order.buyer_nickname`                                        | Vincular pedidos importados                                 | Sin purga                                            | Roles con permiso sobre integraciones                               |
| Actor, IP, navegador, valores antes y después                 | `audit_log`                                                      | Evidencia de operaciones                                    | Inmutable, sin purga                                 | Roles con permiso de auditoría                                      |
| IP de quien firma                                             | `signature.ip_address`                                           | Evidencia de la firma                                       | Sin purga                                            | Roles con permiso sobre el documento firmado                        |
| Identificador de sesión y última actividad                    | `user_session_activity`                                          | Cerrar sesiones inactivas                                   | Sin purga programada                                 | Solo el servidor                                                    |
| IP o identificador de acceso en la clave                      | `rate_limit_bucket`, `rate_limit_lockout`                        | Limitar intentos                                            | Hasta su vencimiento; la limpieza no está verificada | Solo el servidor                                                    |
| Comprobantes de pago                                          | `payment_evidence.evidence_url` y Storage                        | Validar pagos                                               | Sin purga                                            | Roles con permiso sobre pagos                                       |

## Qué entra en la auditoría

`audit_log` no se puede modificar ni borrar, así que lo que entra ahí no se puede suprimir después.

- **No entra:** el RIF del comprador al emitir un documento fiscal. Ya está en `fiscal_document`, enlazado por `entity_id`.
- **Sí entra, por decisión:** el RIF o cédula y la dirección cuando se edita un cliente, porque es la única prueba de quién cambió un dato fiscal; y el correo al invitar a un miembro. Los registros anteriores a esta regla conservan lo que guardaron.

## Logs y errores

- `redactPII` y `redactDeep` en `packages/api/src/logger.ts` ocultan correos, RIF, cédulas, teléfonos, tokens y claves antes de escribir un log. Lo cubre `logging-middleware.test.ts`.
- Sentry corre con `sendDefaultPii: false` en cliente, servidor y edge. No hay `beforeSend`, así que el mensaje de un error llega tal cual si no pasó por el logger.

## Terceros

| Proveedor            | Qué recibe                                                                                                        | Para qué                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Supabase             | Toda la base, Auth y Storage                                                                                      | Infraestructura                                            |
| Vercel               | Peticiones y logs del servidor                                                                                    | Hosting                                                    |
| Sentry               | Errores y el 10 % de las trazas                                                                                   | Monitoreo                                                  |
| Groq                 | Filas y fotos de packing lists: productos y cantidades, no clientes. Las fotos van por URL de Storage o en base64 | Interpretar packing lists con `/api/ai/parse-packing-list` |
| Cloudflare Turnstile | IP y señales del navegador, cuando está configurado                                                               | Frenar bots en el login                                    |
| Mercado Libre        | Credenciales de la integración                                                                                    | Importar pedidos y publicaciones                           |

Si un packing list incluye nombres o direcciones de un proveedor, ese texto también llega a Groq.

## Solicitudes del titular

- `users.exportMyData` entrega perfil, workspaces y los últimos 100 eventos de auditoría.
- `users.anonymizeMyData` anonimiza `user_profile` y retira al usuario de sus workspaces.

**Límites conocidos:**

- No toca `audit_log`, que es inmutable, ni Supabase Auth, donde queda el correo hasta que un administrador elimina la cuenta.
- No existe un flujo equivalente para clientes: una solicitud de un cliente se atiende a mano, y sus documentos fiscales no se pueden borrar.

## Decisiones pendientes

Requieren criterio legal o del negocio, no solo código:

- Plazo de retención de clientes inactivos y de `audit_log`.
- Base legal aplicable y aviso de privacidad para clientes.
- Purga programada de `user_session_activity` y de las tablas de límite de intentos.
