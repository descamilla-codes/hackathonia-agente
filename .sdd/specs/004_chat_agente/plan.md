# Plan — Spec 004: preguntarle al agente

- Spec relacionado: .sdd/specs/004_chat_agente/spec.md
- Fecha: 2026-10-15
- Estado: approved

## Arquitectura / enfoque
- `api/chat.js`: pregunta + contexto del problema visible → Claude → respuesta corta (JSON con esquema).
- Panel en `index.html` al lado de las hojas; lógica en `app.js` (contexto, respuesta local de respaldo).

## Constitution aplicable
- 3: respuesta local con datos del problema si la IA falla. 4: la IA solo usa el contexto enviado. 6: el contexto ya está limpio.

## Módulos / componentes
- `api/chat.js` → RF-3, RF-4, RF-7. `app.js` → RF-1, RF-2, RF-5, RF-6.

## Modelo de datos
- Petición: `{ question, problem: { titulo, descripcion, productos, conversaciones, frases_de_clientes, soluciones } }`.

## Archivos afectados
- Crear: `api/chat.js`. Modificar: `index.html`, `app.js`, `tests/plan.test.js`. Eliminar: N/A.

## Decisiones técnicas clave
- Contexto solo del problema visible. — Descartado: mandar los chats completos; no se guardan (RF-11 de spec 001).
- Sin historial de conversación. — Descartado: memoria multi-turno; más tokens y no se ve en la demo.

## Preguntas abiertas

## Riesgos
- Que el chat parezca la estrella en el pitch: se presenta como apoyo para decidir.

## Estrategia de testing
- Test de validación de entrada; demo manual de las preguntas rápidas.

## Fuera de alcance técnico
- Que el chat proponga soluciones nuevas como tarjeta.
