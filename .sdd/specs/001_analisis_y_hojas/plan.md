# Plan — Spec 001: subir chats, análisis y hojas de decisión

- Spec relacionado: .sdd/specs/001_analisis_y_hojas/spec.md
- Fecha: 2026-10-15
- Estado: approved

## Arquitectura / enfoque
- Página única `index.html` (carga → progreso → hojas → Resumen) con estilos de la maqueta.
- Toda la lógica de chats vive en un módulo JS puro (`lib/chats.js`) que usan el navegador y los tests: lectura de .txt/.zip, parseo, tienda, limpieza, spam por reglas, deduplicado, verificación y conteos.
- Una sola función serverless (`api/analyze.js`) recibe los chats ya limpios, llama a Claude y devuelve JSON estructurado. No guarda nada.
- Respaldo: `fallback.json` con un análisis de ejemplo de los 13 chats de muestra, que pasa la misma verificación.

## Constitution aplicable
- 1 Demo primero: sin chat del agente, sin landing, sin aplicar cambios.
- 2 Mínimo de piezas: HTML+JS sin framework, una función. Única dependencia: SDK oficial de Anthropic (ver decisiones).
- 3 Nunca falla en vivo: timeout 45 s + respaldo (RF-39 a RF-41).
- 4 La IA justifica cada número: verificación y conteos en código (RF-20a a RF-20c).
- 5 El dueño decide: el análisis no toca la tienda (RF-44).
- 6 Sin datos personales: limpieza en el navegador antes de enviar; los chats nunca se guardan (RF-7 a RF-11).
- 7 Secretos fuera del repo: `ANTHROPIC_API_KEY` solo en Vercel.

## Módulos / componentes
- `lib/zip.js` → RF-3 (lector mínimo de .zip con `DecompressionStream`).
- `lib/chats.js` → RF-2, RF-4, RF-6, RF-6a, RF-6c, RF-6d, RF-7, RF-8, RF-9, RF-10, RF-20a, RF-20b, RF-20c, RF-14 a RF-17, casos límite de formato y duplicados.
- `api/analyze.js` → RF-9a, RF-13, RF-18, RF-19, RF-22 a RF-26 (contenido), RF-42, RF-44.
- `index.html` (+ `app.js`) → RF-1, RF-5, RF-6b, RF-10 (aviso), RF-12, RF-20, RF-21 a RF-38 (interacción), RF-39 a RF-41, RF-43.
- `fallback.json` → RF-39 a RF-41.

## Modelo de datos
- Chat limpio enviado a la IA: `{ id: "c1", messages: [{ from: "cliente"|"tienda", text }] }`.
- Respuesta de la IA: `{ problems: [{ topic, title, description, products[], chats[], quotes: [{ chat, text }], no_purchase: [{ chat, text }], solutions: [{ title, what, why, recommended, applies: "tienda"|"tu" }] }], spam: [{ chat, text }] }`.
- Lo conservado en el navegador (RF-37): `{ analysis, picks, fallback }`. Nunca el texto de los chats.

## Archivos afectados
- Crear: `index.html`, `app.js`, `lib/chats.js`, `lib/zip.js`, `api/analyze.js`, `fallback.json`, `package.json`, `vercel.json`, `tests/chats.test.js`, `tests/zip.test.js`, `tests/fixtures/chat.zip`.
- Modificar: `CLAUDE.md` (comando de tests).
- Eliminar: N/A.

## Decisiones técnicas clave
- SDK `@anthropic-ai/sdk` en la función. — Descartada: `fetch` directo; el SDK es la forma oficial y maneja reintentos y errores tipados.
- Modelo `claude-opus-5-5` con `effort: "low"` y respuesta en JSON con esquema (`output_config.format`). — Descartado: herramienta forzada, que este modelo rechaza.
- `fallbacks: "default"` del servidor para rechazos. — Descartado: manejar rechazos a mano; el respaldo local sigue cubriendo el resto.
- Lector .zip propio (~40 líneas) con `DecompressionStream`. — Descartada: librería de zip; agrega dependencia por algo pequeño.
- Verificación y conteos en código, no en la IA. — Descartado: confiar en los números de la IA (principio 4).
- Tests con `node --test`, sin frameworks. — Descartado: Jest o Vitest, dependencias de más.
- Persistencia con `localStorage`. — Descartada: base de datos (principio 2).

## Preguntas abiertas

## Riesgos
- Tiempo de respuesta de la IA cerca de 45 s con muchos chats: `effort: "low"` y `maxDuration` de 60 s en Vercel.
- Formatos de exportación de WhatsApp que no se probaron (otros idiomas o regiones): se descartan con aviso.
- La llave de la API todavía no está configurada en Vercel: sin ella siempre se verá el respaldo.

## Estrategia de testing
- `node --test` sobre `lib/` con los 13 chats de muestra: parseo de ambos formatos, tienda, limpieza, spam, duplicados, límites y verificación.
- El respaldo (`fallback.json`) debe pasar la verificación contra las muestras.
- La función se prueba en vivo una vez que exista la llave; la interacción de las hojas, a mano en el navegador.

## Fuera de alcance técnico
- Límite de análisis por usuario (se quitó RF-45; protege el límite de gasto).
- Chat con el agente, aplicar en Tiendanube y medición.
