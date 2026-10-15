// Applies a validated change plan in the store through Tiendanube's AI connector (MCP), spec 006.
// The connector only accepts OAuth redirects to localhost, so the team authorizes once with
// scripts/conectar-tienda.mjs and the server keeps the token fresh with the refresh token.

export const MCP_URL = "https://admin-mcp.tiendanube.com/";
export const CLIENT_ID = "0353a9e3-d25a-41ad-8290-3bf2dd9b00d8"; // public client (PKCE, no secret)
const AUTH_KEY = "tn:auth";

// Valid access token from Redis, refreshed when it is about to expire. Null if never connected.
export async function accessToken(redis) {
  const auth = JSON.parse((await redis("GET", AUTH_KEY)) || "null");
  if (!auth) return null;
  if (auth.expires_at && auth.expires_at - Date.now() > 60_000) return auth.access_token;
  const r = await fetch(`${MCP_URL}token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: auth.refresh_token, client_id: CLIENT_ID }),
  });
  if (!r.ok) throw new Error(`refresh ${r.status}`);
  const t = await r.json();
  await saveAuth(redis, { ...t, refresh_token: t.refresh_token || auth.refresh_token });
  return t.access_token;
}

export const saveAuth = (redis, t) =>
  redis("SET", AUTH_KEY, JSON.stringify({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: t.expires_in ? Date.now() + t.expires_in * 1000 : null,
  }));

// Minimal MCP client over Streamable HTTP: initialize once, then call tools.
export async function connect(token) {
  let session = null;
  let n = 0;
  const rpc = async (method, params, notify = false) => {
    const id = notify ? undefined : ++n; // per call: tool calls run in parallel
    const r = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(session && { "Mcp-Session-Id": session }),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, ...(!notify && { id }) }),
    });
    if (!r.ok && r.status !== 202) throw new Error(`mcp ${r.status}`);
    session ||= r.headers.get("mcp-session-id");
    if (notify) return null;
    const body = await r.text();
    // SSE replies carry the JSON-RPC message on a "data:" line.
    const json = r.headers.get("content-type")?.includes("event-stream")
      ? body.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5))).find((m) => m.id === id)
      : JSON.parse(body);
    if (json?.error) throw new Error(json.error.message);
    return json.result;
  };
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "convierte", version: "1" } });
  await rpc("notifications/initialized", {}, true);
  return async (name, args) => {
    const res = await rpc("tools/call", { name, arguments: args });
    const text = res?.content?.find((c) => c.type === "text")?.text ?? "";
    if (res?.isError) throw new Error(text.slice(0, 200));
    try { return JSON.parse(text); } catch { return text; }
  };
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;");
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

// Applies each op with call(tool, args); one result per op, a failed op does not stop the rest.
export async function applyPlan(ops, call) {
  const { products = [] } = await call("list_products", { fields_needed: ["id", "name", "description"], page_size: 50 }); // ponytail: one page, the demo store has 20
  const pick = (wanted) => {
    if (!wanted.length) return { found: products, missing: [] };
    const found = [], missing = [];
    for (const w of wanted) {
      const p = products.find((x) => norm(x.name) === norm(w)) || products.find((x) => norm(x.name).includes(norm(w)));
      p ? found.push(p) : missing.push(w);
    }
    return { found, missing };
  };
  const tail = (missing) => (missing.length ? `; no encontrados: ${missing.join(", ")}` : "");

  const results = [];
  for (const op of ops) {
    try {
      if (op.type === "create_coupon") {
        await call("create_coupon", {
          code: op.code,
          type: op.kind,
          ...(op.kind !== "shipping" && { value: op.value }),
          ...(op.min_price && { min_price: op.min_price }),
        });
        results.push({ ok: true, detail: `Cupón ${op.code} creado` });
        continue;
      }
      const { found, missing } = pick(op.products);
      let done = 0, skipped = 0;
      await Promise.all(found.map(async (p) => {
        if (op.type === "free_shipping") {
          await call("update_product", { product_id: Number(p.id), free_shipping: true });
        } else if ((p.description || "").includes(op.text)) {
          return skipped++; // RF-13: never add the same text twice
        } else {
          await call("update_product", { product_id: Number(p.id), description: { es: `${p.description || ""}<p>${escapeHtml(op.text)}</p>` } });
        }
        done++;
      }));
      const verb = op.type === "free_shipping" ? "Envío gratis activado" : "Agregado";
      results.push({ ok: found.length > 0, detail: `${verb} en ${done} productos${skipped ? `, ${skipped} ya lo tenían` : ""}${tail(missing)}` });
    } catch (err) {
      results.push({ ok: false, detail: `No se pudo aplicar: ${String(err.message).slice(0, 150)}` });
    }
  }
  return results.map((r) => ({ ...r, detail: r.detail.slice(0, 300) }));
}
