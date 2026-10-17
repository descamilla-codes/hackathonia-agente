import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPlan } from "../lib/tienda.js";
import { makeHandler } from "../api/queue.js";

const store = () => {
  const products = [
    { id: "1", name: "Jeans Mom Vintage", description: "Jean de prueba." },
    { id: "2", name: "Camisa Lino Arena", description: "Camisa.<p>Envío en 3 a 5 días.</p>" },
  ];
  const calls = [];
  const call = async (name, args) => {
    calls.push([name, args]);
    if (name === "list_products") return { products };
    if (name === "create_coupon" && args.code === "REPETIDO") throw new Error("code already exists");
    return { ok: true };
  };
  return { call, calls };
};

test("applies text, free shipping and coupons; skips repeated text; reports missing", async () => {
  const { call, calls } = store();
  const results = await applyPlan([
    { type: "append_description", products: [], text: "Envío en 3 a 5 días." },
    { type: "free_shipping", products: ["jeans mom vintage", "Vestido Fantasma"] },
    { type: "create_coupon", code: "ENVIO799", kind: "shipping", value: 0, min_price: 799 },
    { type: "create_coupon", code: "REPETIDO", kind: "percentage", value: 10 },
  ], call);

  assert.deepEqual(results.map((r) => r.ok), [true, true, true, false]);
  assert.match(results[0].detail, /1 productos, 1 ya lo tenían/);
  assert.match(results[1].detail, /no encontrados: Vestido Fantasma/);

  const updates = calls.filter(([n]) => n === "update_product").map(([, a]) => a);
  assert.deepEqual(updates[0], { product_id: 1, description: { es: "<p>Jean de prueba.</p><p>Envío en 3 a 5 días.</p>" } });
  assert.deepEqual(updates[1], { product_id: 1, free_shipping: true });
  assert.deepEqual(calls.find(([n, a]) => n === "create_coupon" && a.code === "ENVIO799")[1], { code: "ENVIO799", type: "shipping", min_price: 799 });
});

function fakeRedis(connected) {
  const kv = new Map(connected ? [["tn:auth", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3_600_000 })]] : []);
  return async (cmd, ...a) => {
    if (cmd === "SET") return kv.set(a[0], a[1]) && "OK";
    if (cmd === "GET") return kv.get(a[0]) ?? null;
    if (cmd === "INCR") return kv.set(a[0], String(+(kv.get(a[0]) || 0) + 1)) && +kv.get(a[0]);
    if (["LPUSH", "LTRIM", "EXPIRE"].includes(cmd)) return 1;
    throw new Error(cmd);
  };
}
const call = (h, req) => new Promise((resolve) => h(req, { status: (c) => ({ json: (b) => resolve([c, b]) }) }));
const ops = [{ type: "free_shipping", products: [] }];

test("connected store: the plan is applied right away, at most 10 per hour", async () => {
  const redis = fakeRedis(true);
  const h = makeHandler(redis, async (o) => o.map(() => ({ ok: true, detail: "listo" })));
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    const [, { id }] = await call(h, { method: "POST", query: {}, body: { ops } });
    statuses.push((await call(h, { method: "GET", query: { id } }))[1].status);
  }
  assert.deepEqual(statuses, [...Array(10).fill("applied"), "pending"]);
});

test("not connected or failed apply: the plan stays pending for the laptop applier", async () => {
  for (const [connected, apply] of [[false, null], [true, async () => { throw new Error("mcp 500"); }]]) {
    const h = makeHandler(fakeRedis(connected), apply);
    const [, { id }] = await call(h, { method: "POST", query: {}, body: { ops } });
    assert.equal((await call(h, { method: "GET", query: { id } }))[1].status, "pending");
  }
});

test("parallel tool calls each get their own reply (MCP request ids)", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, { body }) => {
    const { id, method, params } = JSON.parse(body);
    await new Promise((r) => setTimeout(r, id ? (5 - (id % 5)) * 3 : 0)); // replies arrive out of order
    const result = method === "tools/call" ? { content: [{ type: "text", text: JSON.stringify({ echo: params.arguments.product_id }) }] } : {};
    return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`, { headers: { "content-type": "text/event-stream", "mcp-session-id": "s" } });
  };
  try {
    const { connect } = await import("../lib/tienda.js");
    const call = await connect("t");
    const out = await Promise.all([1, 2, 3, 4, 5].map((i) => call("update_product", { product_id: i })));
    assert.deepEqual(out.map((o) => o.echo), [1, 2, 3, 4, 5]);
  } finally {
    globalThis.fetch = real;
  }
});

test("add size: every color, same price, hidden until stock is set; never twice", async () => {
  const v = (id, color, talla) => ({ id: String(id), properties: { Color: color, Talla: talla }, price: { amount: "1500.00" } });
  let variants = [v(1, "Beige", "S"), v(2, "Beige", "L"), v(3, "Azul marino", "S"), v(4, "Azul marino", "L")];
  const calls = [];
  const call = async (name, args) => {
    calls.push([name, args]);
    if (name === "list_products") return { products: [{ id: "9", name: "Pantalón Chino Urbano", description: "", variants }] };
    if (name === "update_product" && args.variants?.[0]?.values) variants = [...variants, ...args.variants.map((x, i) => v(100 + i, x.values[0].es, x.values[1].es))];
    return {};
  };
  const [r] = await applyPlan([{ type: "add_size", product: "Pantalón Chino Urbano", size: "XL", stock: 3 }], call);
  assert.equal(r.ok, true);
  const created = calls.find(([n, a]) => n === "update_product" && a.variants?.[0]?.values)[1].variants;
  assert.deepEqual(created, [
    { price: 1500, visible: false, values: [{ es: "Beige" }, { es: "XL" }] },
    { price: 1500, visible: false, values: [{ es: "Azul marino" }, { es: "XL" }] },
  ]);
  assert.deepEqual(calls.find(([n]) => n === "update_stock_and_price")[1].updates.map((u) => u.stock), [3, 3]);
  const [again] = await applyPlan([{ type: "add_size", product: "Pantalón Chino Urbano", size: "XL", stock: 3 }], call);
  assert.match(again.detail, /ya existía/);
});

test("a plan with a new size needs the owner's pieces before it can be queued", async () => {
  const { validOp, readyToApply } = await import("../lib/plan.js");
  const op = { type: "add_size", product: "Pantalón Chino Urbano", size: "XL", stock: null };
  assert.ok(validOp(op));
  assert.ok(!readyToApply([op]));
  assert.ok(readyToApply([{ ...op, stock: 4 }]));
  assert.ok(!validOp({ ...op, stock: 5000 }));
  assert.ok(!validOp({ ...op, size: "<b>XL" }));
});

test("one plan: later texts append after earlier ones; reworded copies are skipped; one failure does not hide the rest", async () => {
  const products = [{ id: "1", name: "A", description: "Base." }, { id: "2", name: "B", description: "Base." }];
  const writes = [];
  const call = async (name, args) => {
    if (name === "list_products") return { products };
    if (args.product_id === 2 && writes.filter((w) => w.product_id === 2).length) throw new Error("SERVICE_ERROR");
    if (name === "update_product") writes.push(args);
    return {};
  };
  const guide = "Guía de medidas en cm: S 86 de busto y 92 de cadera; M 90 y 96; L 94 y 100; XL 98 y 104.";
  const results = await applyPlan([
    { type: "append_description", products: [], text: guide },
    { type: "append_description", products: [], text: "Envío de 3 a 5 días hábiles con guía de rastreo." },
    { type: "append_description", products: ["A"], text: "Guía de medidas (cm): S 86 de busto y 92 de cadera; M 90 y 96; L 94 y 100; XL 98 y 104." },
  ], call, 0);
  const lastA = writes.filter((w) => w.product_id === 1).at(-1).description.es;
  assert.equal(lastA, `<p>Base.</p><p>${guide}</p><p>Envío de 3 a 5 días hábiles con guía de rastreo.</p>`);
  assert.equal(results[1].ok, false);
  assert.match(results[1].detail, /Agregado en 1 productos; falló en B \(SERVICE_ERROR\)/);
  assert.match(results[2].detail, /1 ya lo tenían/);
});

test("a write that hits the rate limit is retried, not reported as failed", async () => {
  let fails = 2;
  const call = async (name) => {
    if (name === "list_products") return { products: [{ id: "1", name: "A", description: "Base." }] };
    if (fails-- > 0) throw new Error("429 Too Many Requests");
    return {};
  };
  const [r] = await applyPlan([{ type: "append_description", products: [], text: "Compra con confianza." }], call, 0);
  assert.equal(r.ok, true);
});
