// Applies a validated change plan in the store through Tiendanube's AI connector (MCP).
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

// True when the description already carries this text, or a reworded copy of it (80% of its words),
// so running similar plans twice does not stack two size guides.
export function alreadySays(description, text) {
  const plain = norm(description.replace(/<[^>]+>/g, " "));
  if (plain.includes(norm(text))) return true;
  const words = [...new Set(norm(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 || /^\d+$/.test(w)))]; // numbers matter: sizes, prices, days
  return words.length >= 5 && words.filter((w) => plain.includes(w)).length / words.length >= 0.8;
}
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

// Tiendanube allows bursts of about 40 calls, then 2 per second; a 20-product plan with three texts
// goes past that, so a failed write waits and tries again (2s, 4s, 8s). Writes are full descriptions, safe to repeat.
async function retry(fn, wait) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (err) {
      if (i === 3) throw err;
      await new Promise((r) => setTimeout(r, wait * 2 ** i));
    }
  }
}

// Applies each op with call(tool, args); one result per op, a failed op does not stop the rest.
export async function applyPlan(ops, call, wait = 2000) {
  const sizes = ops.some((op) => op.type === "add_size");
  const list = async () => (await call("list_products", { fields_needed: ["id", "name", "description", ...(sizes ? ["variants"] : [])], page_size: 50 })).products || []; // ponytail: one page, the demo store has 20
  let products = await list();
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

  // Latest description per product while this plan runs (the listing comes back as plain text).
  const descriptions = new Map(products.map((p) => {
    const d = p.description || "";
    return [p.id, /<[a-z]/i.test(d) ? d : d ? `<p>${escapeHtml(d)}</p>` : ""];
  }));
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
      if (op.type === "add_size") {
        const r = await addSize(op, pick([op.product]).found[0], call, list);
        products = await list(); // fresh variants for any later size op
        results.push(r);
        continue;
      }
      const { found, missing } = pick(op.products);
      let done = 0, skipped = 0;
      const failed = [];
      let reason = "";
      await Promise.allSettled(found.map(async (p) => {
        try {
          if (op.type === "free_shipping") {
            await retry(() => call("update_product", { product_id: Number(p.id), free_shipping: true }), wait);
          } else {
            const current = descriptions.get(p.id);
            if (alreadySays(current, op.text)) return skipped++; // never add the same (or almost the same) text twice
            const next = `${current}<p>${escapeHtml(op.text)}</p>`;
            await retry(() => call("update_product", { product_id: Number(p.id), description: { es: next } }), wait);
            descriptions.set(p.id, next); // later ops in this plan append after this text, never over it
          }
          done++;
        } catch (err) {
          failed.push(p.name);
          reason ||= String(err.message).slice(0, 80);
        }
      }));
      const verb = op.type === "free_shipping" ? "Envío gratis activado" : "Agregado";
      const fail = failed.length ? `; falló en ${failed.join(", ")} (${reason})` : "";
      results.push({ ok: found.length > 0 && !failed.length, detail: `${verb} en ${done} productos${skipped ? `, ${skipped} ya lo tenían` : ""}${fail}${tail(missing)}` });
    } catch (err) {
      results.push({ ok: false, detail: `No se pudo aplicar: ${String(err.message).slice(0, 150)}` });
    }
  }
  return results.map((r) => ({ ...r, detail: r.detail.slice(0, 300) }));
}

// New size in every existing color, copying the price; hidden until its stock is set, so it never sells without pieces.
async function addSize(op, product, call, list) {
  if (!product) return { ok: false, detail: `No encontrado: ${op.product}` };
  const variants = product.variants || [];
  const order = Object.keys(variants[0]?.properties || {});
  const sizeKey = order.find((k) => /talla|size/i.test(k));
  if (!sizeKey) return { ok: false, detail: "El producto no maneja tallas" };
  const same = (v) => String(v.properties[sizeKey]).toUpperCase() === op.size;
  if (variants.some(same)) return { ok: true, detail: `La talla ${op.size} ya existía` };
  const combos = [...new Map(variants.map((v) => {
    const rest = order.filter((k) => k !== sizeKey).map((k) => v.properties[k]);
    return [rest.join("|"), rest];
  })).values()];
  const price = Number(variants[0].price?.amount ?? variants[0].price);
  const id = Number(product.id);
  await call("update_product", {
    product_id: id,
    variants: combos.map((rest) => {
      let i = 0;
      return { price, visible: false, values: order.map((k) => ({ es: k === sizeKey ? op.size : rest[i++] })) };
    }),
  });
  const created = ((await list()).find((p) => p.id === product.id)?.variants || []).filter(same);
  if (!created.length) return { ok: false, detail: `No se pudo crear la talla ${op.size}` };
  await call("update_stock_and_price", { updates: created.map((v) => ({ product_id: id, variant_id: Number(v.id), stock: op.stock })) });
  await call("update_product", { product_id: id, variants: created.map((v) => ({ id: Number(v.id), visible: true })) });
  return { ok: true, detail: `Talla ${op.size} agregada en ${created.length} colores, ${op.stock} piezas de cada uno, a $${price}` };
}

