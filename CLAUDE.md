# CLAUDE.md — Agente de voz del cliente (HackathonIA)

Lee `.sdd/constitution.md` y la spec activa en `.sdd/specs/` antes de tocar código.

## Proyecto
Panel web para HackathonIA (Utel x Tiendanube). El dueño sube su chat de WhatsApp, la IA encuentra qué dudas frenan la venta y propone cambios a la tienda. HTML + JS sin framework y una función serverless en Vercel que llama a la API de Claude.

## Comandos
- Ejecutar: `npx vercel dev`
- Tests: {pendiente, se define en el primer plan}
- Lint / formato: N/A

## Estilo y convenciones
Código e identificadores en inglés. Textos de pantalla en español. Sin dependencias salvo que la spec lo justifique.

## Reglas
- No añadas dependencias ni cambies contratos de datos sin actualizar antes la spec.
- No modifiques archivos dentro de `.sdd/specs/` salvo petición explícita.
- Nunca subas la llave de la API ni archivos `.env`.

## Al terminar cualquier tarea
- Corre los tests (cuando existan) y confirma en tu respuesta que pasan.
