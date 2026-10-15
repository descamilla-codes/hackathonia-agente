import { prepare, verify, compute, MAX_FILES } from "./lib/chats.js";
import { readZipTexts } from "./lib/zip.js";

const $ = (id) => document.getElementById(id);
const KEY = "agente-state";
const TIMEOUT_MS = 45_000;
const SKIP = -1;

// Every string that may come from a chat or the AI goes through esc (RF-43).
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let files = [];   // [{ name, text }] extracted, kept only in memory (RF-11)
let uploads = 0;
let ready = null; // result of prepare()
let state = null; // { analysis, picks, fallback } persisted (RF-37)
let draft = [];
let current = 0;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
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
  $("analyze").disabled = !ready || !!ready.error;
  if (!ready) return (st.innerHTML = "");

  const discarded = [...preDiscarded, ...(ready.discarded || []).map((n) => files.find((f) => f.name === n)?.label || n)];
  let html = "";
  if (discarded.length) html += `<p class="error">No son chats de WhatsApp y no se usarán: ${discarded.map(esc).join(", ")}</p>`;
  if (ready.error === "limit") html += `<p class="error">Son demasiados. El máximo es ${MAX_FILES} archivos o 5 MB de texto.</p>`;
  if (ready.error === "store") {
    html += `<div class="notice stores"><b>¿Cuál eres tú?</b> No pudimos saber cuál remitente es tu tienda.
      ${ready.storeCandidates.map((s) => `<label><input type="radio" name="store" value="${esc(s)}"> ${esc(s)}</label>`).join("")}</div>`;
  }
  if (ready.removed) {
    const r = ready.removed;
    html += `<p class="notice">Antes de analizar quitamos ${r.names} ${r.names === 1 ? "nombre" : "nombres"}, ${r.phones} ${r.phones === 1 ? "teléfono" : "teléfonos"} y ${r.spam} ${r.spam === 1 ? "mensaje" : "mensajes"} de spam.</p>`;
  }
  if (ready.error === "min") html += `<p class="error">Necesitamos al menos 3 chats con mensajes de clientes. Sube más chats.</p>`;
  if (!ready.error) html += `<p><b>${ready.total} chats listos para analizar.</b></p>`;
  st.innerHTML = html;
}

$("files").addEventListener("change", (e) => readFiles([...e.target.files]));
const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); readFiles([...e.dataTransfer.files]); });
$("status").addEventListener("change", (e) => { if (e.target.name === "store") refresh(e.target.value); });

// ---------- Analyze (RF-6b, RF-12, RF-20, RF-39 to RF-41) ----------

async function useFallback() {
  const fb = await (await fetch("fallback.json")).json();
  return { analysis: compute(fb, fb.total), fallback: true };
}

async function analyze() {
  if (!ready || ready.error) return;
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
  save();
  start();
}
$("analyze").addEventListener("click", analyze);

// ---------- Sheets (RF-21 to RF-36) ----------

function start() {
  if (!state.analysis.problems.length) return show("empty");
  draft = state.picks.map((p) => (p === SKIP ? null : p));
  show("book");
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
  const labels = state.analysis.problems.map((p, i) => esc(p.topic.charAt(0).toUpperCase() + p.topic.slice(1)) + mark(state.picks[i]));
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
  $("sheet").innerHTML = `
    <div class="meta">${p.count} de ${total} conversaciones (${p.pct}%)${lost}${products}</div>
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

function renderSummary() {
  const items = state.analysis.problems.map((p, i) => {
    const pick = state.picks[i];
    if (pick === null) return `<li class="pending"><b>Sin resolver</b> · ${esc(p.title)}</li>`;
    if (pick === SKIP) return `<li><b>No hacer nada</b> · ${esc(p.title)}</li>`;
    const o = p.solutions[pick];
    return `<li><b>${esc(o.title)}</b> · ${esc(p.title)}<small>${esc(o.what)} · ${o.applies === "tienda" ? "Se aplica en tu tienda" : "Lo haces tú"}</small></li>`;
  });
  $("sheet").innerHTML = `
    <div class="summary">
      <div class="meta">Resumen</div>
      <h1>Lo que decidiste</h1>
      <p class="desc">Puedes volver a cualquier hoja para cambiar tu decisión.</p>
      <ol>${items.join("")}</ol>
    </div>`;
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
  else return;
  save();
  go(next());
});

// ---------- Restart and reload (RF-37, RF-38) ----------

$("restart").addEventListener("click", () => {
  try { localStorage.removeItem(KEY); } catch {}
  state = null;
  files = [];
  uploads = 0;
  refresh.pre = [];
  $("files").value = "";
  refresh();
  show("upload");
});

state = load();
if (state?.analysis) start();
else show("upload");
