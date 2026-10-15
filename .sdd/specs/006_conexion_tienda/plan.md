# Plan: Spec 006

- `lib/tienda.js`: cliente MCP mínimo (Streamable HTTP), renovación del permiso guardado en Redis (`tn:auth`) y `applyPlan(ops, call)`.
- `api/queue.js`: al crear un plan, si hay permiso y cupo por hora, lo marca `applying`, lo aplica y lo marca `applied`; si falla, vuelve a `pending`.
- `scripts/conectar-tienda.mjs`: OAuth con PKCE y redirección a `127.0.0.1:8765`; guarda el permiso directo en Upstash leyendo `.env.local`.
- Cliente OAuth público registrado una vez en `admin-mcp.tiendanube.com/register` (sin secreto).
- `vercel.json`: `api/queue.js` con 60 s. `.vercelignore`: `/scripts`.
