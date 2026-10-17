import { prepare, verify, compute, snapshot, compare, TOPICS, MAX_FILES, NO_STORE } from "./lib/chats.js";
import { readZipTexts } from "./lib/zip.js";
import { describe } from "./lib/plan.js";

const $ = (id) => document.getElementById(id);
const KEY = "agente-state";
const HISTORY = "agente-history"; // survives "Nuevo análisis" (spec 003, RF-3)
const TIMEOUT_MS = 45_000;
const SKIP = -1;

// Every string that may come from a chat or the AI goes through esc (RF-43).
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let files = [];   // [{ name, text }] extracted, kept only in memory (RF-11)
let uploads = 0;
let ready = null; // result of prepare()
let state = null; // { analysis, picks, fallback, fallbackPlans?, plan? } persisted (RF-37)
let draft = [];
let current = 0;

function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} // client quotes die with the tab
}
function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
}
function show(id) {
  for (const s of ["upload", "progress", "empty", "book"]) $(s).hidden = s !== id;
  $("restart").hidden = id === "upload" || id === "progress";
  $("banner").hidden = !(id === "book" && state?.fallback);
}

// ---------- Upload (RF-1 to RF-6d, RF-10) ----------

async function readFiles(list) {
  uploads = list.length;
  files = [];
  const discarded = [];
  for (const f of list) {
    if (f.size > 20 * 1024 * 1024) { discarded.push(f.name); continue; } // never read huge files
    try {
      if (/\.zip$/i.test(f.name)) {
        const texts = await readZipTexts(await f.arrayBuffer());
        if (!texts.length) discarded.push(f.name);
        for (const t of texts) files.push({ name: `${f.name}/${t.name}`, text: t.text, label: f.name });
      } else if (/\.txt$/i.test(f.name)) {
        files.push({ name: f.name, text: await f.text(), label: f.name });
      } else discarded.push(f.name);
    } catch {
      discarded.push(f.name);
    }
  }
  refresh(undefined, discarded);
}

function refresh(storeName, preDiscarded = refresh.pre || []) {
  refresh.pre = preDiscarded;
  ready = files.length || uploads ? prepare(files, { storeName, uploadCount: uploads }) : null;
  const st = $("status");
  $("analyze").disabled = !ready || !!ready.error || !$("consent").checked; // the owner confirms customers were told
  if (!ready) return (st.innerHTML = "");

  const discarded = [...preDiscarded, ...(ready.discarded || []).map((n) => files.find((f) => f.name === n)?.label || n)];
  let html = "";
  if (discarded.length) html += `<p class="error">No son chats de WhatsApp y no se usarán: ${discarded.map(esc).join(", ")}</p>`;
  if (ready.error === "limit") html += `<p class="error">Son demasiados chats o demasiado texto. El máximo es ${MAX_FILES} archivos; prueba con menos.</p>`;
  if (ready.error === "store") {
    html += `<div class="notice stores"><b>¿Cuál eres tú?</b> No pudimos saber cuál remitente es tu tienda.
      ${ready.storeCandidates.map((s) => `<label><input type="radio" name="store" value="${esc(s)}"> ${esc(s)}</label>`).join("")}
      <label><input type="radio" name="store" value="${NO_STORE}"> Ninguno, todos son clientes</label></div>`;
  }
  if (ready.removed) {
    const r = ready.removed;
    html += `<p class="notice">Antes de analizar quitamos ${r.names} ${r.names === 1 ? "nombre" : "nombres"}, ${r.phones} ${r.phones === 1 ? "teléfono" : "teléfonos"} y ${r.spam} ${r.spam === 1 ? "mensaje" : "mensajes"} de spam.</p>`;
  }
  if (ready.error === "min") html += `<p class="error">Necesitamos al menos 3 chats con mensajes de clientes. Sube más chats.</p>`;
  if (!ready.error) html += `<p><b>${ready.total} chats listos para analizar.</b></p>`;
  st.innerHTML = html;
}

$("files").addEventListener("change", (e) => { demoWeek = null; readFiles([...e.target.files]); });
const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); demoWeek = null; readFiles([...e.dataTransfer.files]); });
$("status").addEventListener("change", (e) => { if (e.target.name === "store") refresh(e.target.value); });

// ---------- Analyze (RF-6b, RF-12, RF-20, RF-39 to RF-41) ----------

async function useFallback() {
  const fb = await (await fetch("fallback.json")).json();
  return { analysis: compute(fb, fb.total), fallback: true, fallbackPlans: fb.plans };
}

// History is keyed by a one-way hash of the store name, so the server never sees the name.
async function storeKey(name) {
  if (!name || name === NO_STORE) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Previous analysis of this store: server first (any device), this browser as fallback.
async function previous(key) {
  if (key) {
    try {
      const r = await fetch(`api/history?store=${key}`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) return (await r.json())[0] || null;
    } catch {}
  }
  try { return JSON.parse(localStorage.getItem(HISTORY)); } catch { return null; }
}

async function remember(key, entry) {
  try { localStorage.setItem(HISTORY, JSON.stringify(entry)); } catch {}
  if (!key) return;
  try {
    await fetch(`api/history?store=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry), signal: AbortSignal.timeout(5000) });
  } catch {}
}

async function analyze() {
  if (!ready || ready.error) return;
  const total = ready.chats.length;
  const example = demoWeek;
  const key = example ? null : await storeKey(ready.store).catch(() => null);
  $("analyze").disabled = true; // no second analysis while running
  show("progress");
  let result;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch("api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chats: ready.chats }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(res.status);
    const raw = await res.json(); // the 45 s limit also covers reading the body
    clearTimeout(timer);
    const analysis = verify(raw, ready.chats);
    if (raw.problems?.length && !analysis.problems.length) throw new Error("nothing verified"); // RF-40
    result = { analysis, fallback: false };
  } catch {
    result = await useFallback();
  }
  files = [];
  ready = null;
  state = { ...result, picks: new Array(result.analysis.problems.length).fill(null) };
  if (!result.fallback) {
    // Compare with the previous real analysis, then remember this one (spec 003).
    const prev = example === "antes" ? null : await previous(key);
    if (prev) state.compare = prev;
    const date = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    await remember(key, { date, total, topics: snapshot(result.analysis) });
  }
  save();
  start();
}
$("analyze").addEventListener("click", analyze);
$("consent").addEventListener("change", () => { $("analyze").disabled = !ready || !!ready.error || !$("consent").checked; }); // no re-prepare: keeps the chosen store
$("copy-notice").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("notice-copy").textContent); $("copy-notice").textContent = "Copiado"; } catch {}
});

// ---------- Sheets (RF-21 to RF-36) ----------

function start() {
  if (!state.analysis.problems.length) return show("empty");
  draft = state.picks.map((p) => (p === SKIP ? null : p));
  show("book");
  if (!msgs.childElementCount) say(`Encontré ${state.analysis.problems.length} problemas en tus chats. Pregúntame lo que quieras de cada uno.`, "bot");
  current = -1;
  go(next());
}

const SUMMARY = () => state.analysis.problems.length;

function next() {
  const after = state.picks.findIndex((p, i) => p === null && i > current);
  const any = state.picks.indexOf(null);
  return after !== -1 ? after : any !== -1 ? any : SUMMARY();
}

function go(i) {
  current = i;
  i === SUMMARY() ? renderSummary() : renderProblem(i);
  renderTabs();
}

function renderTabs() {
  const mark = (p) => (p === null ? "" : p === SKIP ? '<span class="no">–</span>' : '<span class="ok">✓</span>');
  const labels = state.analysis.problems.map((p, i) => esc(TOPICS[p.topic] || p.topic) + mark(state.picks[i]));
  labels.push("Resumen");
  $("tabs").innerHTML = labels
    .map((l, i) => `<button class="tab" role="tab" aria-selected="${i === current}" data-i="${i}">${l}</button>`)
    .join("");
}

function renderProblem(i) {
  const p = state.analysis.problems[i];
  const total = state.analysis.total;
  const products = p.products?.length ? ` · ${p.products.map(esc).join(", ")}` : "";
  const lost = ` · ${p.noPurchase} no confirmaron compra en el chat`;
  const prev = state.compare;
  const before = prev ? ` · Antes (${esc(prev.date)}): ${prev.topics[p.topic] != null ? prev.topics[p.topic] + "%" : "no se repetía"}` : "";
  $("sheet").innerHTML = `
    <div class="meta">${p.count} de ${total} conversaciones (${p.pct}%)${before}${lost}${products}</div>
    <h1>${esc(p.title)}</h1>
    <p class="desc">${esc(p.description)}</p>
    <div class="quotes">${p.quotes.map((q) => `<span>"${esc(q.text)}"</span>`).join("")}</div>
    <div class="work">
      <div class="options">${p.solutions.map((o, j) => `
        <button class="opt" aria-pressed="${draft[i] === j}" data-j="${j}">
          <span class="tags">${o.recommended ? '<span class="badge">Recomendada</span>' : ""}
            <span class="tag">${o.applies === "tienda" ? "Se aplica en tu tienda" : "Lo haces tú"}</span></span>
          <h3>${esc(o.title)}</h3>
          <p class="what">${esc(o.what)}</p>
          <p class="why"><b>Por qué funciona:</b> ${esc(o.why)}</p>
        </button>`).join("")}
      </div>
      <div class="actions">
        <button class="btn primary accept" ${draft[i] == null ? "disabled" : ""}>Aceptar</button>
        <button class="btn ghost skip">Omitir</button>
      </div>
    </div>`;
}

function accepted() {
  return state.analysis.problems
    .map((p, i) => ({ problem: p, solution: state.picks[i] !== null && state.picks[i] !== SKIP ? p.solutions[state.picks[i]] : null }))
    .filter((x) => x.solution);
}

function renderSummary() {
  const items = state.analysis.problems.map((p, i) => {
    const pick = state.picks[i];
    if (pick === null) return `<li class="pending"><b>Sin resolver</b> · ${esc(p.title)}</li>`;
    if (pick === SKIP) return `<li><b>No hacer nada</b> · ${esc(p.title)}</li>`;
    const o = p.solutions[pick];
    return `<li><b>${esc(o.title)}</b> · ${esc(p.title)}<small>${esc(o.what)} · ${o.applies === "tienda" ? "Se aplica en tu tienda" : "Lo haces tú"}</small></li>`;
  });
  const mine = accepted().filter((x) => x.solution.applies === "tu");
  const store = accepted().filter((x) => x.solution.applies === "tienda");
  $("sheet").innerHTML = `
    <div class="summary">
      <div class="meta">Resumen</div>
      <h1>Lo que decidiste</h1>
      <p class="desc">Puedes volver a cualquier hoja para cambiar tu decisión.</p>
      <ol>${items.join("")}</ol>
      ${renderCompare()}
      ${mine.length ? `<p><b>Para hacer tú:</b></p><ul>${mine.map((x) => `<li>${esc(x.solution.what)}</li>`).join("")}</ul>` : ""}
      <div id="apply">${renderApply(store.length)}</div>
    </div>`;
}

function renderCompare() {
  if (!state.compare) return "";
  const rows = compare(state.compare.topics, snapshot(state.analysis));
  const cell = (v, other) => (v != null ? `${v}%` : other != null ? "no se repite" : "");
  return `<p><b>Antes y después</b> <span class="muted">(comparado con tu análisis del ${esc(state.compare.date)})</span></p>
    <table class="compare"><tr><th>Tema</th><th>Antes</th><th>Ahora</th></tr>
    ${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.before != null ? r.before + "%" : "nuevo"}</td><td>${cell(r.after, r.before)}</td></tr>`).join("")}</table>`;
}

// ---------- Apply in the store (spec 002) ----------

function renderApply(storeCount) {
  const plan = state.plan;
  const opsList = (ops, results) => `<ol>${ops.map((op, i) => {
    const r = results?.[i];
    const mark = r ? (r.ok ? "✓ " : "✗ ") : "";
    return `<li><b>${mark}${esc(describe(op))}</b>${op.text ? `<small>"${esc(op.text)}"</small>` : ""}${r ? `<small>${esc(r.detail)}</small>` : ""}</li>`;
  }).join("")}</ol>`;

  if (!plan || plan.status === "error") {
    return `${plan ? `<p class="error">No pudimos preparar los cambios. Intenta de nuevo.</p>` : ""}
      <button class="btn primary apply-btn" ${storeCount ? "" : "disabled"}>Aplicar en mi tienda</button>
      ${storeCount ? "" : `<p class="muted">Acepta al menos una solución que se aplique en tu tienda.</p>`}`;
  }
  if (plan.status === "loading") return `<div class="row"><div class="spinner" aria-hidden="true"></div><b>Preparando los cambios…</b></div>`;
  if (plan.status === "preview") {
    const sizes = plan.ops.map((op, i) => (op.type === "add_size" ? i : -1)).filter((i) => i >= 0);
    const ask = sizes.map((i) => `<label class="stock">¿Cuántas piezas de talla ${esc(plan.ops[i].size)} tienes de cada color en ${esc(plan.ops[i].product)}?
      <input type="number" min="1" max="999" step="1" inputmode="numeric" data-i="${i}" required></label>`).join("");
    return `<div class="notice"><b>Esto es lo que va a cambiar en tu tienda:</b>${opsList(plan.ops)}${ask}</div>
      <div class="row"><button class="btn primary confirm" ${sizes.length ? "disabled" : ""}>Confirmar y aplicar</button><button class="btn ghost cancel">Cancelar</button></div>`;
  }
  if (plan.status === "pending") {
    const late = Date.now() - plan.since > 120_000;
    return `<div class="row"><div class="spinner" aria-hidden="true"></div><b>Aplicando en tu tienda…</b></div>
      ${late ? `<p class="muted">Tu plan quedó guardado. El agente lo aplicará en cuanto se conecte.</p>` : ""}${opsList(plan.ops)}`;
  }
  if (plan.status === "applied") {
    const ok = plan.results?.filter((r) => r.ok).length || 0;
    const head = ok === plan.ops.length ? "Aplicado ✓" : ok ? `Se aplicaron ${ok} de ${plan.ops.length} cambios` : "No se pudo aplicar ningún cambio";
    return `<p class="notice"><b>${head}</b></p>${opsList(plan.ops, plan.results)}`;
  }
  // manual: no queue available (RF-18)
  return `<p class="notice">El plan está listo. Cópialo y pídele al agente que lo aplique.</p>
    <textarea readonly rows="8" style="width:100%">${esc(JSON.stringify(plan.ops, null, 2))}</textarea>
    <div class="row"><button class="btn ghost copy">Copiar plan</button></div>`;
}

function rerenderApply() {
  if (current === SUMMARY() && $("apply")) $("apply").innerHTML = renderApply(accepted().some((x) => x.solution.applies === "tienda"));
}

async function preparePlan() {
  const items = accepted().filter((x) => x.solution.applies === "tienda");
  state.plan = { status: "loading" };
  rerenderApply();
  try {
    let ops;
    if (state.fallback) {
      ops = items.flatMap((x) => state.fallbackPlans?.[`${x.problem.topic}|${x.solution.title}`] || []);
      if (!ops.length) throw new Error("no example plan");
    } else {
      const res = await fetch("api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((x) => ({
          problem: { topic: x.problem.topic, title: x.problem.title, description: x.problem.description, products: x.problem.products },
          solution: { title: x.solution.title, what: x.solution.what, why: x.solution.why },
          facts: (state.analysis.facts || []).filter((f) => f.topic === x.problem.topic).map((f) => f.fact).slice(0, 10),
        })) }),
      });
      if (!res.ok) throw new Error(res.status);
      ops = (await res.json()).ops;
    }
    state.plan = { status: "preview", ops };
  } catch {
    state.plan = { status: "error" };
  }
  save();
  rerenderApply();
}

// A new size needs its pieces before anything is applied (never infinite stock).
function stockFromInputs() {
  const ops = state.plan.ops.map((op) => ({ ...op }));
  for (const input of document.querySelectorAll("label.stock input")) {
    const n = Number(input.value);
    if (!Number.isInteger(n) || n < 1 || n > 999) return null;
    ops[+input.dataset.i].stock = n;
  }
  return ops;
}

$("sheet").addEventListener("input", (e) => {
  if (e.target.closest("label.stock")) document.querySelector(".confirm").disabled = !stockFromInputs();
});

async function confirmPlan() {
  const ops = stockFromInputs();
  if (!ops) return;
  try {
    const res = await fetch("api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops }) });
    if (!res.ok) throw new Error(res.status);
    state.plan = { status: "pending", ops, id: (await res.json()).id, since: Date.now() };
    poll();
  } catch {
    state.plan = { status: "manual", ops };
  }
  save();
  rerenderApply();
}

let polling = null;
function poll() {
  clearInterval(polling);
  polling = setInterval(async () => {
    if (state?.plan?.status !== "pending") return clearInterval(polling);
    try {
      const plan = await (await fetch(`api/queue?id=${encodeURIComponent(state.plan.id)}`)).json();
      if (plan.status === "applied") {
        state.plan = { ...state.plan, status: "applied", results: plan.results };
        save();
      }
    } catch {}
    rerenderApply();
  }, 3000);
}

$("tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (t) go(+t.dataset.i);
});

$("sheet").addEventListener("click", (e) => {
  const o = e.target.closest(".opt");
  if (o) {
    const j = +o.dataset.j;
    draft[current] = draft[current] === j ? null : j; // second click unselects
    return renderProblem(current);
  }
  if (e.target.closest(".accept")) state.picks[current] = draft[current];
  else if (e.target.closest(".skip")) { state.picks[current] = SKIP; draft[current] = null; }
  else if (e.target.closest(".apply-btn")) return preparePlan();
  else if (e.target.closest(".confirm")) return confirmPlan();
  else if (e.target.closest(".cancel")) { state.plan = null; save(); return rerenderApply(); }
  else if (e.target.closest(".copy")) return navigator.clipboard?.writeText(JSON.stringify(state.plan.ops, null, 2));
  else return;
  if (state.plan?.status === "preview" || state.plan?.status === "error") state.plan = null;
  save();
  go(next());
});

// ---------- Chat with the agent (spec 004) ----------

const msgs = $("msgs");
function say(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text; // plain text (RF-6)
  msgs.append(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function chatContext() {
  if (current === SUMMARY()) {
    return { resumen: accepted().map((x) => ({ problema: x.problem.title, decision: x.solution.title })) };
  }
  const p = state.analysis.problems[current];
  return {
    titulo: p.title, descripcion: p.description, productos: p.products,
    conversaciones: `${p.count} de ${state.analysis.total} (${p.pct}%)`,
    frases_de_clientes: p.quotes.map((q) => q.text),
    soluciones: p.solutions.map((o) => ({ titulo: o.title, que: o.what, por_que: o.why, recomendada: o.recommended })),
  };
}

// Answer from the problem's own data when the AI is unavailable (RF-5): nothing invented.
function localAnswer(question) {
  if (current === SUMMARY()) return "Revisa tu resumen: cada decisión viene de lo que más repitieron tus clientes.";
  const p = state.analysis.problems[current];
  const rec = p.solutions.find((o) => o.recommended);
  if (/otra|opci/i.test(question)) return `Las otras opciones son: ${p.solutions.filter((o) => !o.recommended).map((o) => o.title).join(" y ")}.`;
  if (/client|dijeron|dicen/i.test(question)) return `Por ejemplo: ${p.quotes.map((q) => `"${q.text}"`).join(" y ")}.`;
  return `Recomiendo "${rec.title}": ${rec.why}`;
}

let asking = false;
async function ask(question) {
  question = question.trim().slice(0, 300);
  if (!question || !state || asking) return;
  asking = true;
  say(question, "me");
  const typing = document.createElement("div");
  typing.className = "msg bot typing";
  typing.setAttribute("aria-label", "El agente está escribiendo");
  typing.innerHTML = 'Escribiendo<span aria-hidden="true">.</span><span aria-hidden="true">.</span><span aria-hidden="true">.</span>';
  msgs.append(typing);
  msgs.scrollTop = msgs.scrollHeight;
  let answer;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    if (state.fallback) throw new Error("example analysis");
    const res = await fetch("api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, problem: chatContext() }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(res.status);
    answer = (await res.json()).answer;
    clearTimeout(timer);
  } catch {
    answer = localAnswer(question);
  }
  typing.remove();
  say(answer, "bot");
  asking = false;
}

$("ask").addEventListener("submit", (e) => {
  e.preventDefault();
  ask($("q").value);
  $("q").value = "";
});
$("chips").addEventListener("click", (e) => {
  if (e.target.closest(".chip")) ask(e.target.textContent);
});

// ---------- Example chats (spec 005) ----------

// Example chats: week 1 always starts fresh and week 2 compares only with this browser's week 1,
// so the demo never mixes with other visitors' runs or with real stores' history on the server.
let demoWeek = null;
async function loadExamples(which) {
  try {
    const index = await (await fetch("muestras/index.json")).json();
    const dir = which === "antes" ? "muestras/chats/" : "muestras/chats_despues/";
    const list = await Promise.all(index[which].map(async (name) => {
      const res = await fetch(dir + encodeURIComponent(name));
      if (!res.ok) throw new Error(res.status);
      return new File([await res.text()], name);
    }));
    await readFiles(list);
    demoWeek = which;
  } catch {
    $("status").innerHTML = `<p class="error">No pudimos cargar los chats de ejemplo. Puedes subir los tuyos.</p>`;
  }
}
$("demo-antes").addEventListener("click", () => loadExamples("antes"));
$("demo-despues").addEventListener("click", () => loadExamples("despues"));

// ---------- Restart and reload (RF-37, RF-38) ----------

function reset(screen) {
  try { sessionStorage.removeItem(KEY); } catch {}
  clearInterval(polling);
  msgs.textContent = "";
  state = null;
  files = [];
  uploads = 0;
  refresh.pre = [];
  $("files").value = "";
  refresh();
  show(screen);
}
$("restart").addEventListener("click", () => reset("upload"));
$("home").addEventListener("click", () => reset("upload"));

state = load();
if (state?.plan?.status === "loading") state.plan = null;
if (state?.analysis) start();
else show("upload");
if (state?.plan?.status === "pending") poll();
