import { test } from "node:test";
import assert from "node:assert/strict";
import { validOp, validPlan, describe } from "../lib/plan.js";
import { makeHandler } from "../api/queue.js";
import { normalize } from "../api/plan.js";

const desc = { type: "append_description", products: [], text: "Envío a todo México en 3 a 5 días." };
const coupon = { type: "create_coupon", code: "ENVIO799", kind: "shipping", value: 0, min_price: 799 };

test("only the three allowed change types pass (RF-4, RF-14)", () => {
  assert.ok(validOp(desc));
  assert.ok(validOp(coupon));
  assert.ok(validOp({ type: "free_shipping", products: ["Jeans Mom Vintage"] }));
  assert.ok(!validOp({ type: "delete_product", products: ["Jeans Mom Vintage"] }));
  assert.ok(!validOp({ type: "update_price", price: 1 }));
});

test("limits: text length, coupon code, discount, plan size (RNF)", () => {
  assert.ok(!validOp({ ...desc, text: "x".repeat(401) }));
  assert.ok(!validOp({ ...desc, text: "Este jean talla [normal / grande]" }));
  assert.ok(!validOp({ ...coupon, code: "envio gratis" }));
  assert.ok(!validOp({ ...coupon, kind: "percentage", value: 90 }));
  assert.ok(!validPlan([]));
  assert.ok(!validPlan(Array(11).fill(desc)));
  assert.ok(validPlan([desc, coupon]));
});

test("preview lines in plain Spanish (RF-5)", () => {
  assert.equal(describe(desc), "Agregar a la descripción de todos los productos");
  assert.equal(describe(coupon), "Crear el cupón ENVIO799: envío gratis en compras desde $799");
});

test("AI output is reduced to the fields each type uses", () => {
  const op = normalize({ type: "create_coupon", products: ["x"], text: "y", code: "ENVIO799", kind: "shipping", value: 5, min_price: 0 });
  assert.deepEqual(op, { type: "create_coupon", code: "ENVIO799", kind: "shipping", value: 0, min_price: null });
});

function fakeRedis() {
  const kv = new Map();
  const lists = new Map();
  return async (cmd, ...a) => {
    if (cmd === "SET") return kv.set(a[0], a[1]) && "OK";
    if (cmd === "GET") return kv.get(a[0]) ?? null;
    if (cmd === "MGET") return a.map((k) => kv.get(k) ?? null);
    if (cmd === "LPUSH") return lists.set(a[0], [a[1], ...(lists.get(a[0]) || [])]).size;
    if (cmd === "LTRIM") return "OK";
    if (cmd === "LRANGE") return lists.get(a[0]) || [];
    throw new Error(cmd);
  };
}

const call = (h, req) => new Promise((resolve) => h(req, { status: (c) => ({ json: (b) => resolve([c, b]) }) }));

test("queue: create, list pending, mark applied once (RF-6, RF-10, RF-15)", async () => {
  const h = makeHandler(fakeRedis());
  const [c1, { id }] = await call(h, { method: "POST", query: {}, body: { ops: [desc, coupon] } });
  assert.equal(c1, 201);
  const [, pending] = await call(h, { method: "GET", query: { status: "pending" } });
  assert.deepEqual(pending.map((p) => p.id), [id]);

  const results = [{ ok: true, detail: "20 productos" }, { ok: true, detail: "Cupón creado" }];
  assert.equal((await call(h, { method: "POST", query: { id, action: "applied" }, body: { results } }))[0], 200);
  assert.equal((await call(h, { method: "POST", query: { id, action: "applied" }, body: { results } }))[0], 409);
  const [, plan] = await call(h, { method: "GET", query: { id } });
  assert.equal(plan.status, "applied");
  assert.equal((await call(h, { method: "GET", query: { status: "pending" } }))[1].length, 0);
});

test("queue rejects invalid plans and results (RF-14)", async () => {
  const h = makeHandler(fakeRedis());
  assert.equal((await call(h, { method: "POST", query: {}, body: { ops: [{ type: "delete_product" }] } }))[0], 400);
  const [, { id }] = await call(h, { method: "POST", query: {}, body: { ops: [desc] } });
  assert.equal((await call(h, { method: "POST", query: { id, action: "applied" }, body: { results: [] } }))[0], 400);
});

test("queue unavailable answers 503 so the page offers copy (RF-18)", async () => {
  assert.equal((await call(makeHandler(null), { method: "POST", query: {}, body: { ops: [desc] } }))[0], 503);
});

test("chat: question required, max 300 chars, bounded context (spec 004, RF-7)", async () => {
  const { validChat } = await import("../api/chat.js");
  const problem = { titulo: "Tallas" };
  assert.ok(validChat({ question: "¿Por qué recomiendas esa?", problem }));
  assert.ok(!validChat({ question: "   ", problem }));
  assert.ok(!validChat({ question: "x".repeat(301), problem }));
  assert.ok(!validChat({ question: "hola", problem: { big: "x".repeat(7000) } }));
});

test("security: caps on coupons, products and published text (review)", () => {
  assert.ok(!validOp({ ...coupon, kind: "absolute", value: 999999 }));
  assert.ok(validOp({ ...coupon, kind: "absolute", value: 200 }));
  assert.ok(!validOp({ ...desc, products: Array(26).fill("x") }));
  for (const bad of ["Visita www.estafa.com", "Escribe a pagos@tienda.mx", "Deposita a 1234567890", "<script>alert(1)</script>", "ve a https://x.co"]) {
    assert.ok(!validOp({ ...desc, text: bad }), bad);
  }
});

test("security: plan and analyze inputs are bounded (review)", async () => {
  const { validItems } = await import("../api/plan.js");
  const { validChats } = await import("../api/analyze.js");
  const item = { problem: { topic: "tallas", title: "t", description: "d", products: ["Jeans"] }, solution: { title: "s", what: "w", why: "y" } };
  assert.ok(validItems([item]));
  assert.ok(!validItems([{ ...item, problem: { ...item.problem, description: "x".repeat(5000) } }]));
  const chat = (text) => ({ id: "c", messages: [{ from: "cliente", text }] });
  assert.ok(validChats([chat("hola"), chat("hola"), chat("hola")]));
  assert.ok(!validChats([chat("x".repeat(2001)), chat("hola"), chat("hola")]));
});
