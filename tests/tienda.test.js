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

test("applies text, free shipping and coupons; skips repeated text; reports missing (spec 006)", async () => {
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
  assert.deepEqual(updates[0], { product_id: 1, description: { es: "Jean de prueba.<p>Envío en 3 a 5 días.</p>" } });
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
