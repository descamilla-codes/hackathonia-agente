import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { prepare, verify, compute, isSpam } from "../lib/chats.js";

const dir = new URL("../muestras/chats/", import.meta.url);
const samples = readdirSync(dir).map((name) => ({ name, text: readFileSync(new URL(name, dir), "utf8") }));
const fallback = JSON.parse(readFileSync(new URL("../fallback.json", import.meta.url), "utf8"));

test("samples: store, valid chats and cleaning counts (RF-6c, RF-10)", () => {
  const r = prepare(samples);
  assert.equal(r.error, undefined);
  assert.equal(r.store, "Utel Equipo3");
  assert.equal(r.total, 11);
  assert.deepEqual(r.removed, { names: 6, phones: 7, spam: 5 });
});

test("no client name or phone survives cleaning (RF-7, RF-8)", () => {
  const all = prepare(samples).chats.flatMap((c) => c.messages.map((m) => m.text)).join("\n");
  for (const leak of ["Mariana", "López", "Jorge", "Paty", "Ruiz", "Daniela", "Fer!", "Ale!", "1234", "0001"]) {
    assert.ok(!all.includes(leak), `leaked: ${leak}`);
  }
  assert.match(all, /Hola \[nombre\]!/);
});

test("spam rules: promo link, chain, job offer; real questions kept (RF-9)", () => {
  assert.ok(isSpam("FELICIDADES Tu número ganó un bono. Reclámalo aquí: bit.ly/x"));
  assert.ok(isSpam("Reenviado: comparte este mensaje con 10 contactos"));
  assert.ok(isSpam("Trabajo desde casa, ganancia de $800 a $3,000 al día"));
  assert.ok(!isSpam("cuánto sale el envío a Monterrey?"));
  const ale = prepare(samples).chats.find((c) => c.messages.some((m) => /transparenta/.test(m.text)));
  assert.ok(ale.messages.some((m) => /talla es la M/.test(m.text)));
  assert.ok(!ale.messages.some((m) => /URGENTE/.test(m.text)));
});

test("duplicates count once, non-chat files are discarded (RF-4, RF-5)", () => {
  const r = prepare([...samples, { ...samples[3], name: "copia.txt" }, { name: "foto.txt", text: "hola" }]);
  assert.equal(r.total, 11);
  assert.deepEqual(r.discarded, ["foto.txt"]);
});

test("fewer than 3 valid chats is an error (RF-6)", () => {
  assert.equal(prepare(samples.filter((s) => /Fer|Ale/.test(s.name))).error, "min");
});

test("upload limits (RF-6a)", () => {
  assert.equal(prepare(samples, { uploadCount: 51 }).error, "limit");
  assert.equal(prepare([{ name: "big.txt", text: "x".repeat(5 * 1024 * 1024 + 1) }]).error, "limit");
});

test("no common sender asks for the store, and storeName resolves it (RF-6d)", () => {
  const two = samples.map((s) => ({ ...s, text: s.text.replaceAll("Utel Equipo3", s.name.length % 2 ? "Tienda A" : "Tienda B") }));
  const r = prepare(two);
  assert.equal(r.error, "store");
  assert.ok(r.storeCandidates.includes("Tienda A"));
  assert.equal(prepare(two, { storeName: "Tienda A" }).store, "Tienda A");
});

test("fallback passes verification against the samples (RF-39, RF-20a)", () => {
  const { chats } = prepare(samples);
  const v = verify(fallback, chats);
  assert.equal(v.problems.length, fallback.problems.length);
  assert.deepEqual(v.problems.map((p) => [p.count, p.pct, p.noPurchase]), [[4, 36, 2], [4, 36, 1], [3, 27, 1]]);
});

test("invented quote or too few chats removes only that problem (RF-20b)", () => {
  const { chats } = prepare(samples);
  const bad = structuredClone(fallback);
  bad.problems[0].quotes[0].text = "esta frase nadie la escribió";
  bad.problems[2].chats = ["c4", "c5"];
  assert.deepEqual(verify(bad, chats).problems.map((p) => p.topic), ["confianza"]);
});

test("invented no-purchase quote drops only that chat from the count (RF-18, RF-20b)", () => {
  const { chats } = prepare(samples);
  const bad = structuredClone(fallback);
  bad.problems[0].no_purchase[0].text = "no compré nada";
  assert.equal(verify(bad, chats).problems.find((p) => p.topic === "tallas").noPurchase, 1);
});

test("numbers come from code, not from the AI (RF-17, RF-20c, RF-25)", () => {
  const r = compute({ problems: [{ chats: ["c1", "c2", "c3"], no_purchase: [], count: 99, pct: 99,
    solutions: [{ recommended: true }, { recommended: true }, { recommended: false }] }] }, 8);
  assert.equal(r.problems[0].count, 3);
  assert.equal(r.problems[0].pct, 38);
  assert.deepEqual(r.problems[0].solutions.map((s) => s.recommended), [true, false, false]);
});

test("at most 10 problems, sorted by chats (RF-15, RF-16)", () => {
  const p = (n) => ({ chats: Array.from({ length: n }, (_, i) => `c${i}`), no_purchase: [], solutions: [{}, {}, {}] });
  const r = compute({ problems: Array.from({ length: 12 }, (_, i) => p(3 + (i % 4))) }, 20);
  assert.equal(r.problems.length, 10);
  assert.ok(r.problems.every((x, i, a) => i === 0 || a[i - 1].count >= x.count));
});

test("quotes from fewer than 2 distinct chats remove the problem (RF-19)", () => {
  const { chats } = prepare(samples);
  const bad = structuredClone(fallback);
  bad.problems[0].quotes[1] = { chat: "c3", text: "que talla me queda si uso 28 de cintura?" };
  assert.ok(!verify(bad, chats).problems.some((p) => p.topic === "tallas"));
});

test("a quote the AI itself marked as spam is not evidence (RF-9a)", () => {
  const { chats } = prepare(samples);
  const marked = { ...structuredClone(fallback), spam: [{ chat: "c9", text: "mido 1.85, no sé si me quede la L" }] };
  assert.ok(!verify(marked, chats).problems.some((p) => p.topic === "tallas"));
});
