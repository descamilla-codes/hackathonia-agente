# CLAUDE.md, Convierte (HackathonIA)

Lee `README.md` y `ARQUITECTURA.md` antes de tocar código.

## Proyecto
Panel web para HackathonIA (Utel x Tiendanube). El dueño sube su chat de WhatsApp, la IA encuentra qué dudas frenan la venta y propone cambios a la tienda. HTML + JS sin framework y funciones serverless en Vercel que llaman a la API de Claude.

Estado: archivado desde el 2026-10-17. Para volver a levantarlo, sigue "Reactivar el proyecto" en `ARQUITECTURA.md`.

## Comandos
- Ejecutar: `npx vercel dev`
- Tests: `npm test` (node --test, sin dependencias)

## Estilo y convenciones
Código e identificadores en inglés. Textos de pantalla en español. Sin dependencias nuevas si unas líneas lo resuelven.

## Agente aplicador
Cuando Diego diga "arranca el agente aplicador", sigue `AGENTE.md`.

## Reglas
- Nunca subas la llave de la API ni archivos `.env`.
- Git: en este proyecto se permite commitear directo en `main`.

## Al terminar cualquier tarea
- Corre los tests y confirma en tu respuesta que pasan.
