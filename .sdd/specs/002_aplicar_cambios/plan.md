# Plan — Spec 002: aplicar los cambios aprobados

- Spec relacionado: .sdd/specs/002_aplicar_cambios/spec.md
- Fecha: 2026-10-15
- Estado: approved

## Arquitectura / enfoque
- `api/plan.js`: recibe las soluciones aceptadas y pide a Claude un plan de cambios concretos (JSON con esquema).
- `api/queue.js`: fila de planes en Upstash Redis (REST con `fetch`, sin dependencia): crear, consultar, listar pendientes y marcar aplicado.
- `lib/plan.js`: validación de planes compartida por página, servidor y tests (tipos permitidos, límites, códigos de cupón).
- Página: botón en el Resumen, vista previa, espera con consulta cada 3 s y resultado.
- Agente aplicador: Claude Code siguiendo `AGENTE.md`; vigila la fila con `Monitor`, aplica con el conector `tiendanube-equipo3` y marca el resultado.

## Constitution aplicable
- 2 (v1.1): segunda y tercera función, y Redis solo para la fila.
- 3: plan de ejemplo en `fallback.json` y copia manual si no hay fila.
- 5: nada se aplica sin "Confirmar y aplicar".
- 6: los planes no llevan datos de clientes (RNF).
- 7: credenciales de Redis solo en Vercel.

## Módulos / componentes
- `lib/plan.js` → RF-4, RF-14, RNF de límites.
- `api/plan.js` → RF-3, RF-9.
- `api/queue.js` → RF-6, RF-10, RF-15, RF-18.
- `app.js` → RF-1, RF-2, RF-5, RF-7, RF-8, RF-10, RF-16, RF-17, recarga.
- `AGENTE.md` (procedimiento del agente) → RF-11 a RF-15.

## Modelo de datos
- Cambio: `{ type: "append_description", products: [nombres] | [], text }`, `{ type: "create_coupon", code, kind: "percentage"|"absolute"|"shipping", value, min_price }`, `{ type: "free_shipping", products: [nombres] | [] }`. `products: []` = todos.
- Plan en la fila: `{ id, status: "pending"|"applied", created, ops, results? }`, llave `plan:<id>` y lista `plans`.

## Archivos afectados
- Crear: `api/plan.js`, `api/queue.js`, `lib/plan.js`, `AGENTE.md`, `tests/plan.test.js`.
- Modificar: `app.js`, `index.html`, `fallback.json` (planes de ejemplo), `vercel.json`.
- Eliminar: N/A.

## Decisiones técnicas clave
- Fila en Upstash Redis vía REST. — Descartada: Vercel Blob o GitHub como fila; más lentos o requieren token propio.
- El agente aplicador es Claude Code con el conector oficial. — Descartado: token de app de socio (trámite) y conector desde la API (autorización no exportable).
- Vigilancia con `Monitor` (consulta cada 5 s). — Descartado: `/loop`, mínimo 60 s entre vueltas.
- El texto exacto se genera antes de aprobar. — Descartado: que el agente aplicador redacte al aplicar; rompería la vista previa (principio 5).

## Preguntas abiertas

## Riesgos
- Cualquiera con el link puede encolar un plan: el agente solo acepta los tres tipos y revisa el contenido antes de aplicar; la página solo está arriba para la demo.
- Si la laptop o la sesión se cierran, los planes esperan en la fila.
- Requiere crear Upstash en Vercel (5 min, lo hace Diego).

## Estrategia de testing
- `node --test` sobre `lib/plan.js` (tipos, límites, cupones) y sobre `api/queue.js` con un Redis simulado.
- Prueba real de punta a punta en la tienda del equipo cuando exista la fila.

## Fuera de alcance técnico
- Autenticación del agente aplicador frente a la fila.
- Deshacer cambios.
