# Plan — Spec 003: medir el antes y el después

- Spec relacionado: .sdd/specs/003_antes_y_despues/spec.md
- Fecha: 2026-10-15
- Estado: approved

## Arquitectura / enfoque
- Temas fijos como `enum` en el esquema de la IA; etiquetas en español en `lib/chats.js`.
- `snapshot()` y `compare()` en `lib/chats.js`; el registro vive en `localStorage` con llave propia.
- La página compara al terminar un análisis real y muestra el antes en cada hoja y una tabla en el Resumen.

## Constitution aplicable
- 4: los porcentajes de ambos lados salen del código, nunca de la IA.
- 6: el registro solo guarda temas y porcentajes.

## Módulos / componentes
- `lib/chats.js` (`TOPICS`, `snapshot`, `compare`) → RF-1, RF-2, RF-5, RF-6.
- `api/analyze.js` (enum de temas) → RF-1.
- `app.js` → RF-2 a RF-7.

## Modelo de datos
- `agente-history`: `{ date: "15 oct", topics: { tallas: 36, envio: 27 } }`.

## Archivos afectados
- Crear: `muestras/chats_despues/*`.
- Modificar: `lib/chats.js`, `api/analyze.js`, `app.js`, `index.html`, `fallback.json` (tema `envio`), `tests/chats.test.js`.
- Eliminar: N/A.

## Decisiones técnicas clave
- Temas fijos en el esquema. — Descartado: comparar por texto libre; la IA nombra distinto el mismo tema.
- Solo el último análisis. — Descartado: historial completo; no se ve en la demo.

## Preguntas abiertas

## Riesgos
- Si el dueño analiza el respaldo, no hay comparación (RF-7).

## Estrategia de testing
- Tests de `snapshot` y `compare`; validez de las muestras "después".

## Fuera de alcance técnico
- Gráficas.
