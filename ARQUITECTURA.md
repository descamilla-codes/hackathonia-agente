# Arquitectura de Convierte

## Vista general

```
Navegador (demo.html + app.js)
  │  lee .txt/.zip, limpia nombres y teléfonos, valida
  │
  ├── POST /api/analyze ──► Claude API ──► problemas + 3 soluciones
  │      (el navegador verifica citas y calcula los números)
  ├── POST /api/chat ─────► Claude API ──► respuesta sobre un problema
  ├── POST /api/plan ─────► Claude API ──► cambios concretos validados
  ├── POST /api/queue ────► Upstash Redis (fila de planes)
  │                           └─► si la tienda está conectada:
  │                               MCP de Tiendanube ──► cambios en la tienda
  └── GET/POST /api/history ► Upstash Redis (porcentajes por tema)
```

Todo es estático más funciones serverless en Vercel. No hay servidor propio ni base de datos relacional.

## Componentes

### Navegador
- `demo.html` y `app.js`: la app completa. Guarda el estado de la sesión en `sessionStorage` (se borra al cerrar la pestaña).
- `lib/chats.js`: parsea chats de Android y iPhone, quita spam, anonimiza y detecta quién es la tienda. También **verifica** la respuesta de la IA: descarta problemas con citas inventadas o con menos de 3 chats, y calcula todos los números en código. La IA nunca pone porcentajes.
- `lib/zip.js`: lector de `.zip` mínimo, con tope contra zip bombs.
- Si la IA falla o tarda más de 45 s, la app usa `fallback.json` y lo marca con un aviso.

### Funciones (`api/`)
| Endpoint | Qué hace |
|---|---|
| `POST /api/analyze` | Manda los chats a Claude y regresa problemas, citas, soluciones y datos que la tienda ya dio. Máximo 60 s. |
| `POST /api/plan` | Convierte las soluciones elegidas en cambios. Solo 4 tipos: `append_description`, `create_coupon`, `free_shipping`, `add_size`. |
| `POST /api/chat` | Responde preguntas del dueño sobre el problema en pantalla, máximo 3 oraciones. |
| `GET/POST /api/queue` | Fila de planes aprobados. Al crear un plan, lo aplica de inmediato si hay tienda conectada; si no, queda pendiente para el aplicador manual. |
| `GET/POST /api/history` | Últimos 10 análisis por tienda: fecha, número de chats y % por tema. Sin texto de chats. |

### Claude (`lib/claude.js`)
- Modelo `claude-opus-5-5`, salida JSON con esquema, `effort: low`.
- Usa el respaldo del servidor (`server-side-fallback-2026-07-01`) por si el modelo está saturado.
- El prompt de sistema junta `prompts/agente.md` (personalidad y reglas) y `prompts/consultor.md` (método de consultor). Se editan sin tocar código.
- Cada respuesta trae el header `X-Usage` con tokens de entrada y salida, para medir costo.

### Tienda (`lib/tienda.js`)
- Cliente MCP mínimo sobre HTTP contra `https://admin-mcp.tiendanube.com/`.
- OAuth con PKCE y cliente público. El conector solo acepta redirecciones a localhost, por eso la autorización se hace una vez desde la laptop con `scripts/conectar-tienda.mjs`. El servidor guarda el token en Redis y lo renueva solo.
- Reintenta con espera creciente cuando Tiendanube limita la velocidad (unas 40 llamadas seguidas y luego 2 por segundo).
- No repite un texto que la descripción ya tiene (compara 80 % de las palabras).

### Aplicador manual (`AGENTE.md`)
Plan B cuando la tienda no está conectada al servidor: Claude Code vigila la fila, le pide el "sí" a Diego por cada plan y aplica con el conector MCP.

## Datos en Redis

| Llave | Contenido | Vida |
|---|---|---|
| `plans` | Lista de los últimos 50 ids de plan | Sin expiración |
| `plan:<id>` | Plan con sus cambios, estado y resultados | 7 días |
| `history:<sha256>` | Últimos 10 análisis de una tienda. La llave es el hash del nombre, calculado en el navegador | Sin expiración |
| `tn:auth` | Token de acceso y de renovación de la tienda | Sin expiración |
| `tn:applies:<hora>` | Contador de aplicaciones por hora (máximo 10) | 1 hora |

## Variables de entorno

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Llamadas a Claude. Sin ella, la demo usa el ejemplo. |
| `KV_REST_API_URL` y `KV_REST_API_TOKEN` | Upstash Redis. También sirve `REDIS_REST_*` o un prefijo como `STORAGE_KV_REST_API_URL`. Vercel las pone solas al conectar Upstash. |

## Seguridad y privacidad
- Los chats nunca se guardan: viven en memoria del navegador y en la llamada a Claude.
- Nombres y teléfonos se quitan antes de enviar.
- Todo texto que viene de chats o de la IA se escapa antes de mostrarse.
- Los cambios a la tienda pasan por una lista blanca (`lib/plan.js`): sin enlaces, correos, números largos ni HTML; cupones de máximo 50 % o 500 pesos.

## Límites conocidos
- La página es pública y no tiene cuentas. Cualquiera con el link puede crear planes (por eso el tope de 10 por hora).
- Una sola tienda conectada a la vez (`tn:auth` es global).
- Lee solo la primera página de 50 productos.
- Hasta 50 archivos y 400,000 caracteres por análisis.

## Costos medidos
- IA: unos 3 pesos por análisis completo (hasta 9 con chats largos). Una pregunta al chat cuesta unos 0.34 pesos.
- Como SaaS con planes de pago: unos 1,460 pesos al mes fijos (hosting, Redis, monitoreo, correos, repositorio y dominio).

## Reactivar el proyecto

El 2026-10-17 se dio de baja todo: proyecto de Vercel borrado, base de Upstash borrada, llave de Claude revocada y repo archivado. Para levantarlo de nuevo:

1. **Desarchiva el repo.**
   ```bash
   gh repo unarchive descamilla-codes/hackathonia-agente
   ```
2. **Quita la pantalla de pausa.** `vercel.json` manda todo a `/pausa`. Borra el bloque `redirects` de `vercel.json` y el archivo `pausa.html`, o revierte el commit `6c79846`.
3. **Crea una llave nueva de Claude** en console.anthropic.com > Acceso > Claves de API.
4. **Crea el proyecto en Vercel.** Add New > Project > importa el repo. Ponle `hackathonia-agente` para recuperar la misma URL, si sigue libre. Agrega `ANTHROPIC_API_KEY` en Settings > Environment Variables.
5. **Crea la base de Redis.** En Vercel > Storage, crea una Upstash Redis y conéctala al proyecto. La base nace vacía: no hay historial ni planes viejos.
6. **Redeploy** desde Vercel para que tome las variables.
7. **Conecta una tienda** (solo si quieres que aplique cambios solo). En la laptop:
   ```bash
   npx vercel env pull .env.local
   ```
   ```bash
   node scripts/conectar-tienda.mjs
   ```
   Se abre el navegador para autorizar la tienda. La tienda del hackathon (Utel Equipo3) no era nuestra; probablemente necesites otra tienda Tiendanube con el conector de IA habilitado.
8. **Si usas el aplicador manual**, vuelve a agregar el conector a Claude Code y revisa que la URL de `AGENTE.md` siga siendo la correcta:
   ```bash
   claude mcp add --transport http tiendanube https://admin-mcp.tiendanube.com
   ```
9. **Verifica.** Corre `npm test`, abre `/demo`, usa "Lee mis chats" con los chats de ejemplo y aplica un plan.

### Revisa antes de reactivar
- **Modelo:** si `claude-opus-5-5` ya no está disponible, cambia el modelo en `lib/claude.js`. Si el beta `server-side-fallback-2026-07-01` ya no existe, quita `betas` y `fallbacks`.
- **Conector de Tiendanube:** el `CLIENT_ID` de `lib/tienda.js` es el cliente público del conector. Si Tiendanube lo cambia, la autorización falla.
- **Plan de Vercel:** Hobby no permite uso comercial. Para cobrar, pasa a Pro.
- **Si va a ser producto real:** hacen falta cuentas de usuario, una conexión de tienda por usuario y cobro. Hoy nada de eso existe.
