# Convierte

Agente de IA para tiendas en línea. Lee los chats de WhatsApp de la tienda, encuentra las dudas que se repiten antes de comprar y propone 3 soluciones por problema. El dueño decide y el agente aplica los cambios en Tiendanube.

Proyecto del HackathonIA (Utel x Tiendanube, octubre 2026).

> **Estado:** archivado. El sitio, la base de datos y la llave de la API se dieron de baja el 2026-10-17. Para volver a levantarlo, sigue [Reactivar el proyecto](ARQUITECTURA.md#reactivar-el-proyecto).

## Cómo funciona

1. **Analiza.** El dueño sube sus chats exportados de WhatsApp (`.txt` o `.zip`). El navegador los limpia y quita nombres y teléfonos antes de enviarlos.
2. **Propone.** Claude agrupa las dudas por tema (tallas, envío, pagos...) y propone 3 soluciones por problema, con frases reales de clientes como evidencia.
3. **Tú decides.** El dueño elige qué soluciones aplicar y puede preguntarle al agente sobre cada problema.
4. **Aplica.** El agente convierte las soluciones en cambios concretos y los aplica en la tienda: texto en descripciones, cupones, envío gratis o una talla nueva.

Después se puede volver a analizar para comparar el antes y el después por tema.

## Stack

- HTML, CSS y JavaScript sin framework.
- Funciones serverless en Vercel (`api/`).
- Claude API (`claude-opus-5-5`) con el SDK `@anthropic-ai/sdk`, única dependencia.
- Upstash Redis por REST, para la fila de planes, el historial y la sesión de la tienda.
- Conector MCP de Tiendanube para aplicar cambios.

## Correr en local

Requisitos: Node 20 o mayor y la CLI de Vercel.

```bash
npm install
```

Crea `.env.local` con las variables de [ARQUITECTURA.md](ARQUITECTURA.md#variables-de-entorno). Luego:

```bash
npx vercel dev
```

Sin Upstash la app funciona igual, pero sin fila de planes ni historial en servidor. Sin llave de Claude, la demo usa el análisis de ejemplo (`fallback.json`).

## Tests

```bash
npm test
```

## Estructura

| Carpeta / archivo | Qué tiene |
|---|---|
| `index.html` | Landing |
| `demo.html`, `app.js` | La app: subir chats, hojas de decisión, aplicar y chat |
| `api/` | Funciones serverless: análisis, plan, chat, fila e historial |
| `lib/` | Lógica compartida entre navegador, servidor y tests |
| `prompts/` | Personalidad del agente y lineamientos de consultor, editables sin tocar código |
| `muestras/` | Chats de ejemplo (antes y una semana después) |
| `fallback.json` | Análisis de ejemplo cuando la IA no responde |
| `scripts/conectar-tienda.mjs` | Autoriza la tienda una sola vez |
| `AGENTE.md` | Instrucciones del aplicador manual con Claude Code |

Detalle completo en [ARQUITECTURA.md](ARQUITECTURA.md).
