// Chat logic shared by the page and the tests: parse, clean, verify, count.

export const MAX_FILES = 50;
export const MAX_TEXT_BYTES = 5 * 1024 * 1024;
export const MIN_CHATS = 3;
export const MAX_MESSAGE = 2000; // characters kept per message
export const MAX_TOTAL = 400_000; // characters sent per analysis (cost cap, same as the server)
export const MAX_PROBLEMS = 10;
export const NO_STORE = "__none__"; // owner says every sender is a customer
const SELF = /^(tú|tu|you|yo)$/i; // export owner label, not a person's name

// Fixed topics so analyses can be compared (spec 003, RF-1).
export const TOPICS = {
  tallas: "Tallas", envio: "Envío", pagos: "Pagos", confianza: "Confianza", devoluciones: "Devoluciones",
  precio: "Precio", disponibilidad: "Disponibilidad", calidad: "Calidad", otro: "Otro",
};

const SP = "[\\s\\u00a0\\u202f]";
const TIME = `\\d{1,2}:\\d{2}(?::\\d{2})?(?:${SP}*[ap]\\.?${SP}?m\\.?)?`;
const DATE = "\\d{1,2}/\\d{1,2}/\\d{2,4}";
const ANDROID = new RegExp(`^${DATE},?${SP}+${TIME}${SP}+-${SP}+(.*)$`, "i");
const IOS = new RegExp(`^\\[${DATE},?${SP}+${TIME}\\]${SP}+(.*)$`, "i");

const SYSTEM_TEXT = [
  /^<?(multimedia omitido|media omitted|imagen omitida|video omitido|audio omitido|sticker omitido)>?$/i,
  /(se eliminó este mensaje|este mensaje fue eliminado|eliminaste este mensaje|this message was deleted)/i,
  /cifrados de extremo a extremo|end-to-end encrypted/i,
];

// Returns { messages: [{ sender, text }] } or null when no line looks like a WhatsApp message.
export function parseChat(text) {
  const messages = [];
  let last = null;
  for (const rawLine of text.replace(/‎|‏/g, "").split(/\r?\n/)) {
    const m = rawLine.match(ANDROID) || rawLine.match(IOS);
    if (m) {
      const sep = m[1].indexOf(": ");
      last = null;
      if (sep === -1) continue; // system line without sender
      const msg = { sender: m[1].slice(0, sep).trim(), text: m[1].slice(sep + 2).trim() };
      if (SYSTEM_TEXT.some((r) => r.test(msg.text))) continue;
      messages.push(msg);
      last = msg;
    } else if (last && rawLine.trim()) {
      last.text += "\n" + rawLine.trim(); // multi-line message
    }
  }
  return messages.length ? { messages } : null;
}

const URL_RE = /(https?:\/\/|www\.|bit\.ly|\b[\w-]+\.(com|mx|ly|link|net)\/)/i;
const PROMO_RE = /(felicidades|ganaste|ganador|bono|premio|reclam|gratis|regalo|sorteo)/i;
const CHAIN_RE = /(^reenviado\b|comparte este mensaje|reenv[ií]alo|a \d+ contactos)/i;
const JOB_RE = /(trabajo desde casa|ganancias?|ganar dinero|recursos humanos|\$\s?[\d,.]+\s+(a|al)\s+d[ií]a)/i;

export function isSpam(text) {
  return CHAIN_RE.test(text) || JOB_RE.test(text) || (URL_RE.test(text) && PROMO_RE.test(text));
}

const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const isPhone = (s) => /^\+?[\d\s().-]{8,}$/.test(s.trim());
const digits = (s) => s.replace(/\D/g, "");

function nameFromFile(file) {
  const m = file.replace(/\.(txt|zip)$/i, "").match(/(?:\bcon|\bwith|-)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * files: [{ name, text }] already extracted from .txt/.zip; uploadCount: files the owner picked.
 * Returns { error?, chats, discarded, store, storeCandidates, removed, total }.
 */
export function prepare(files, { storeName, uploadCount = files.length } = {}) {
  const bytes = files.reduce((n, f) => n + new TextEncoder().encode(f.text).length, 0);
  if (uploadCount > MAX_FILES || bytes > MAX_TEXT_BYTES) return { error: "limit", chats: [], discarded: [] };

  const discarded = [];
  const seen = new Set();
  const parsed = [];
  for (const f of [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const chat = parseChat(f.text);
    if (!chat) { discarded.push(f.name); continue; }
    const key = chat.messages.map((m) => m.sender + "\u0000" + m.text).join("\u0001");
    if (seen.has(key)) continue; // same chat uploaded twice
    seen.add(key);
    chat.file = f.name;
    for (const m of chat.messages) m.spam = isSpam(m.text);
    // Spam-only: every message is spam, or a lone sender (nobody answered) sent mostly spam.
    const lone = new Set(chat.messages.map((m) => m.sender)).size === 1;
    const spamCount = chat.messages.filter((m) => m.spam).length;
    chat.spamOnly = spamCount === chat.messages.length || (lone && spamCount * 2 >= chat.messages.length);
    if (chat.spamOnly) for (const m of chat.messages) m.spam = true;
    parsed.push(chat);
  }

  // Store = the only sender present in every chat that is not spam-only.
  const real = parsed.filter((c) => !c.spamOnly);
  const chatsBySender = new Map();
  for (const c of real) for (const s of new Set(c.messages.map((m) => m.sender))) chatsBySender.set(s, (chatsBySender.get(s) || 0) + 1);
  const common = [...chatsBySender].filter(([, n]) => n === real.length).map(([s]) => s);
  const storeCandidates = [...chatsBySender].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const store = storeName || (common.length === 1 ? common[0] : null);
  if (!store) return { error: "store", chats: [], discarded, storeCandidates };
  if (!storeName) {
    // Auto-detected store left too few customer chats: let the owner choose (RF-6d).
    const auto = prepare(files, { storeName: store, uploadCount });
    const other = [...storeCandidates.filter((c) => c !== store), NO_STORE];
    if (auto.error === "min" && other.some((c) => !prepare(files, { storeName: c, uploadCount }).error)) {
      return { error: "store", chats: [], discarded, storeCandidates };
    }
    return auto;
  }

  // Client names to remove: senders and file names that are not the store or a phone.
  const names = new Set();
  const phones = new Set();
  for (const c of parsed) {
    for (const who of [...new Set(c.messages.map((m) => m.sender)), nameFromFile(c.file)]) {
      if (!who || who === store || SELF.test(who)) continue;
      if (isPhone(who)) phones.add(digits(who));
      else names.add(who);
    }
  }
  const nameTokens = new Set();
  for (const n of names) {
    nameTokens.add(n);
    for (const w of n.split(/\s+/)) if (w.length >= 3) nameTokens.add(w);
  }
  const nameRe = nameTokens.size
    ? new RegExp(`(?<!\\p{L})(${[...nameTokens].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?!\\p{L})`, "giu")
    : null;
  const clean = (t) => {
    t = t.replace(EMAIL_RE, "[correo]");
    t = t.replace(PHONE_RE, (p) => { phones.add(digits(p)); return "[teléfono]"; });
    return nameRe ? t.replace(nameRe, "[nombre]") : t;
  };

  let spam = 0;
  const chats = [];
  for (const c of parsed) {
    const messages = [];
    for (const m of c.messages) {
      if (m.spam) { spam++; continue; }
      messages.push({ from: m.sender === store ? "tienda" : "cliente", text: clean(m.text).slice(0, MAX_MESSAGE) });
    }
    if (!messages.some((m) => m.from === "cliente")) continue; // spam-only or empty
    chats.push({ id: `c${chats.length + 1}`, messages });
  }

  const removed = { names: names.size, phones: phones.size, spam };
  const chars = chats.reduce((n, c) => n + c.messages.reduce((k, m) => k + m.text.length, 0), 0);
  if (chars > MAX_TOTAL) return { error: "limit", chats: [], discarded, store, storeCandidates, removed };
  if (chats.length < MIN_CHATS) return { error: "min", chats, discarded, store, storeCandidates, removed };
  return { chats, discarded, store, storeCandidates, removed, total: chats.length };
}

const norm = (s) => s.toLowerCase().replace(/^["“”'\s]+|["“”'\s]+$/g, "").replace(/\s+/g, " ");

function quoteIsReal(q, byId, allowed, spam) {
  if (!q || !allowed.has(q.chat) || !q.text) return false;
  const needle = norm(q.text);
  if (!needle) return false;
  // A message the AI marked as spam is never evidence (RF-9a).
  if ((spam.get(q.chat) || []).some((s) => s.includes(needle) || needle.includes(s))) return false;
  return byId.get(q.chat).messages.some((m) => m.from === "cliente" && norm(m.text).includes(needle));
}

/**
 * Keeps only the problems whose evidence exists in the chats (RF-20a/b) and
 * computes every number in code (RF-20c). Returns { problems, total }.
 */
export function verify(analysis, chats) {
  const byId = new Map(chats.map((c) => [c.id, c]));
  const spam = new Map();
  for (const s of analysis?.spam || []) if (s?.chat && s.text) spam.set(s.chat, [...(spam.get(s.chat) || []), norm(s.text)]);
  const problems = [];
  for (const p of analysis?.problems || []) {
    const cited = new Set((p.chats || []).filter((id) => byId.has(id)));
    if (cited.size < MIN_CHATS) continue;
    const quotes = p.quotes || [];
    if (!quotes.every((q) => quoteIsReal(q, byId, cited, spam))) continue;
    if (new Set(quotes.map((q) => q.chat)).size < 2) continue;
    if ((p.solutions || []).length !== 3) continue;
    const noPurchase = (p.no_purchase || []).filter((q) => quoteIsReal(q, byId, cited, spam));
    problems.push({ ...p, chats: [...cited], quotes: pickTwo(quotes), no_purchase: dedupeByChat(noPurchase) });
  }
  // Every topic a customer asked about, even below MIN_CHATS, so the before/after can show a drop to 1 chat.
  const counts = {};
  for (const t of analysis?.topics || []) {
    if (!TOPICS[t?.topic]) continue;
    const ids = new Set([...(counts[t.topic] || []), ...(t.chats || []).filter((id) => byId.has(id))]);
    counts[t.topic] = [...ids];
  }
  for (const p of problems) counts[p.topic] = [...new Set([...(counts[p.topic] || []), ...p.chats])];
  const topics = {};
  for (const [t, ids] of Object.entries(counts)) if (ids.length) topics[t] = Math.round((ids.length / chats.length) * 100);
  // What the store already answered (sizes, shipping...), only if the store really said it.
  const facts = (analysis?.facts || [])
    .filter((f) => TOPICS[f?.topic] && typeof f.fact === "string" && f.fact.length <= 150 && byId.has(f.chat) && f.quote &&
      byId.get(f.chat).messages.some((m) => m.from === "tienda" && norm(m.text).includes(norm(f.quote))))
    .slice(0, 30)
    .map(({ topic, fact }) => ({ topic, fact }));
  return { ...compute({ problems }, chats.length), topics, facts };
}

const pickTwo = (quotes) => dedupeByChat(quotes).slice(0, 2);
function dedupeByChat(quotes) {
  const seen = new Set();
  return quotes.filter((q) => !seen.has(q.chat) && seen.add(q.chat));
}

// Numbers, order and the single "recommended" flag, all from code.
export function compute(analysis, total) {
  const problems = analysis.problems
    .map((p) => {
      let rec = p.solutions.findIndex((s) => s.recommended);
      if (rec === -1) rec = 0;
      return {
        ...p,
        count: p.chats.length,
        pct: Math.round((p.chats.length / total) * 100),
        noPurchase: p.no_purchase.length,
        solutions: p.solutions.map((s, i) => ({ ...s, recommended: i === rec })),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_PROBLEMS);
  return { problems, total };
}

// Last analysis as { topic: pct }, no chat text (spec 003, RF-2).
export function snapshot(analysis) {
  if (analysis.topics) return { ...analysis.topics };
  const topics = {};
  for (const p of analysis.problems) topics[p.topic] = Math.max(topics[p.topic] || 0, p.pct);
  return topics;
}

// Rows for the before/after table (spec 003, RF-5, RF-6).
export function compare(before, after) {
  return [...new Set([...Object.keys(after), ...Object.keys(before)])].map((topic) => ({
    topic,
    label: TOPICS[topic] || topic,
    before: before[topic] ?? null,
    after: after[topic] ?? null,
  }));
}
