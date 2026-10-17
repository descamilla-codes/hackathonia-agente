// One-time store authorization. Run it on the team laptop: node scripts/conectar-tienda.mjs
// Needs the Upstash REST URL and token in .env.local (copy them from Vercel > Storage). Never prints tokens.
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { MCP_URL, CLIENT_ID, saveAuth, connect } from "../lib/tienda.js";

const REDIRECT = "http://127.0.0.1:8765/callback";
const SCOPE = "read_products write_products read_coupons write_coupons";

let envText;
try { envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8"); } catch {
  console.error("Falta el archivo .env.local con las llaves de Upstash (cópialas de Vercel > Storage).");
  process.exit(1);
}
const vars = Object.fromEntries(
  envText.split("\n")
    .map((l) => l.match(/^\s*([\w]+)\s*=\s*"?([^"]*)"?\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const find = (re) => Object.entries(vars).find(([k, v]) => re.test(k) && v)?.[1];
const URL_ = find(/(KV_REST_API|REDIS_REST)_URL$/);
const TOKEN = find(/(KV_REST_API|REDIS_REST)_TOKEN$/);
if (!URL_ || !TOKEN) throw new Error("Falta la URL o el token de Upstash en .env.local");
const redis = async (...cmd) => {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
};

const b64 = (b) => b.toString("base64url");
const verifier = b64(randomBytes(32));
const state = b64(randomBytes(16));
const url = `${MCP_URL}authorize?${new URLSearchParams({
  response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT, scope: SCOPE, state,
  code_challenge: b64(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256",
})}`;

const server = createServer(async (req, res) => {
  const q = new URL(req.url, REDIRECT).searchParams;
  if (!req.url.startsWith("/callback")) return res.end();
  try {
    if (q.get("state") !== state || !q.get("code")) throw new Error(q.get("error") || "respuesta inválida");
    const r = await fetch(`${MCP_URL}token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: REDIRECT, client_id: CLIENT_ID, code_verifier: verifier }),
    });
    if (!r.ok) throw new Error(`token ${r.status}`);
    const t = await r.json();
    await saveAuth(redis, t);
    const { products = [] } = await (await connect(t.access_token))("list_products", { fields_needed: ["id"], page_size: 50 });
    console.log(`Listo: tienda conectada, ${products.length} productos visibles. Ya puedes cerrar esto.`);
    res.end("Tienda conectada. Puedes cerrar esta ventana.");
  } catch (err) {
    console.error("No se pudo conectar:", err.message);
    res.end("No se pudo conectar. Revisa la terminal.");
  }
  server.close();
});

server.listen(8765, "127.0.0.1", () => {
  console.log("Abriendo Tiendanube para autorizar…");
  execFile("open", [url]);
});
